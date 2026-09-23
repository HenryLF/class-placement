import { useRef, useState } from "preact/hooks";
import {
  dragBoard,
  useClassRoom,
  useCurrentClass,
  type Board,
  type BoardHandle,
  type Table as TableData,
} from "../../store/useClassRoom";
import { usePlacements, useSeating } from "../../store/usePlacements";
import { useCurrentStudentClass, type Student } from "../../store/useStudents";
import f from "../../style/furniture.module.css";
import { useDraggable, useDropTarget, useIsDragging } from "../../utils/dnd";
import type { ViolationKind } from "../../utils/placement";
import { useT } from "../../i18n";
import TableShape from "../atoms/TableShape";
import Whiteboard from "../atoms/Whiteboard";
import s from "./ClassRoom.module.css";

export default function ClassRoom() {
  const { id: roomId, rows, cols, tables, board } = useCurrentClass();
  const classId = useCurrentStudentClass().id;
  const { seated, disabled, violations } = useSeating();
  const showMarks = usePlacements((st) => st.showMarks);
  const toggleTable = usePlacements((st) => st.toggleTable);

  // Each violation marks both tables, pointing at each other.
  const marks = new Map<string, Mark[]>();
  const mark = (id: string, m: Mark) => marks.set(id, [...(marks.get(id) ?? []), m]);
  if (showMarks)
    for (const v of violations) {
      mark(v.a, { kind: v.kind, dr: v.dr, dc: v.dc });
      if (v.b) mark(v.b, { kind: v.kind, dr: -v.dr, dc: -v.dc });
    }

  const byCell = new Map(tables.map((t) => [`${t.row}:${t.col}`, t]));

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const table = byCell.get(`${row}:${col}`);
      cells.push(
        <Cell
          key={`${row}:${col}`}
          row={row}
          col={col}
          table={table}
          student={table && seated.get(table.id)}
          marks={table && marks.get(table.id)}
          off={!!table && disabled.has(table.id)}
          onToggle={() => table && toggleTable(roomId, classId, table.id)}
        />,
      );
    }
  }

  return (
    <div className={s.room}>
      <div
        className={s.container}
        style={{ "--n_cols": cols, "--n_rows": rows }}
      >
        <BoardRow board={board} cols={cols} />
        {cells}
      </div>
    </div>
  );
}

// A broken constraint seen from one table: (dr, dc) points at the neighbor
// (or, for a front-row student, at the whiteboard).
interface Mark {
  kind: ViolationKind;
  dr: number;
  dc: number;
}

function Cell({
  row,
  col,
  table,
  student,
  marks,
  off,
  onToggle,
}: {
  row: number;
  col: number;
  table: TableData | undefined;
  student: Student | undefined;
  marks: Mark[] | undefined;
  off: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const addTable = useClassRoom((st) => st.addTable);
  const moveTable = useClassRoom((st) => st.moveTable);
  // Moved tables may land anywhere: on another table, they swap.
  const { dropProps, isOver } = useDropTarget(`cell:${row}:${col}`, {
    accepts: () => true,
    onDrop: (p) => moveTable(p.id, row, col),
  });

  // A click on an empty cell adds a table; a click on a table toggles it.
  return (
    <div
      {...dropProps}
      className={`${s.cell} ${table ? "" : s.empty} ${isOver ? s.over : ""}`}
      onClick={table ? undefined : () => addTable(row, col)}
    >
      {table && (
        <Table
          table={table}
          label={student && (student.name || t.common.unnamed)}
          off={off}
          onToggle={onToggle}
        />
      )}
      {marks && <ViolationMarks marks={marks} />}
    </div>
  );
}

// First grid row, a third of a cell's height: the whiteboard, which is
// dragged sideways and resized by its edges. It moves by half columns and
// is saved on release. Not a dnd.ts drag: it isn't dropped anywhere.
function BoardRow({ board, cols }: { board: Board; cols: number }) {
  const t = useT();
  const setBoard = useClassRoom((st) => st.setBoard);
  const rowRef = useRef<HTMLDivElement>(null);
  // Position while dragging, before it's saved.
  const [live, setLive] = useState<Board | null>(null);
  const shown = live ?? board;

  const grab = (handle: BoardHandle) => (down: PointerEvent) => {
    if (down.button !== 0 || !rowRef.current) return;
    // A handle is inside the board: don't also start a move.
    down.stopPropagation();
    const gap = parseFloat(getComputedStyle(rowRef.current.parentElement!).columnGap) || 0;
    const colWidth = (rowRef.current.clientWidth + gap) / cols;
    let next = board;

    const move = (e: PointerEvent) => {
      if (e.pointerId !== down.pointerId) return;
      next = dragBoard(board, handle, (e.clientX - down.clientX) / colWidth, cols);
      setLive(next);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== down.pointerId) return;
      finish();
      if (next.col !== board.col || next.span !== board.span) setBoard(next);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("keydown", key);
      setLive(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("keydown", key);
  };

  return (
    <div ref={rowRef} className={s.boardRow}>
      <Whiteboard
        data-testid="whiteboard"
        className={`${f.draggable} ${s.board} ${live ? s.moving : ""}`}
        style={{ "--col": shown.col, "--span": shown.span }}
        onPointerDown={grab("move")}
      >
        {(["left", "right"] as const).map((edge) => (
          <span
            key={edge}
            data-testid={`board-${edge}`}
            aria-label={t.classroom.resizeBoard}
            className={`${s.handle} ${s[edge]}`}
            onPointerDown={grab(edge)}
          />
        ))}
      </Whiteboard>
      <Trash />
    </div>
  );
}

// Bin at the left end of the whiteboard row, shown only while a table is
// dragged. It may cover the board, never a cell.
function Trash() {
  const t = useT();
  const removeTable = useClassRoom((st) => st.removeTable);
  const dragging = useIsDragging(() => true);
  const { dropProps, isOver } = useDropTarget("trash", {
    accepts: () => true,
    onDrop: (p) => removeTable(p.id),
  });
  if (!dragging) return null;

  return (
    <div
      {...dropProps}
      data-testid="trash"
      aria-label={t.tables.trash}
      className={`${s.trash} ${isOver ? s.trashOver : ""}`}
    >
      🗑
    </div>
  );
}

// A click switches the table off (or back on) for the loaded class's
// placement. Tables are removed by dropping them on the bin.
function Table({
  table,
  label,
  off,
  onToggle,
}: {
  table: TableData;
  label: string | undefined;
  off: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const drag = useDraggable({ kind: "table", id: table.id });
  const dragging = useIsDragging((p) => p.id === table.id);

  return (
    <TableShape
      {...drag}
      label={label}
      data-testid="table"
      data-off={off || undefined}
      role="switch"
      aria-checked={!off}
      aria-label={label ?? (off ? t.tables.off : t.tables.alt)}
      className={`${f.draggable} ${s.table} ${off ? s.off : ""} ${dragging ? s.dragging : ""}`}
      onClick={onToggle}
    />
  );
}

// Arrows on the cell's edges and corners, pointing at the neighbor each
// broken constraint involves. Arrows on the same edge sit side by side.
const INSET = 10;

function ViolationMarks({ marks }: { marks: Mark[] }) {
  const groups = new Map<string, Mark[]>();
  for (const m of marks) {
    const key = `${m.dr}:${m.dc}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return (
    <>
      {[...groups.values()].map((group) => {
        const { dr, dc } = group[0]!;
        return (
          <div
            key={`${dr}:${dc}`}
            className={`${s.marks} ${dr !== 0 && dc === 0 ? "" : s.vertical}`}
            style={{
              // Just inside the edge, so a neighbor's arrows don't overlap.
              top: `calc(${(dr + 1) * 50}% - ${dr * INSET}px)`,
              left: `calc(${(dc + 1) * 50}% - ${dc * INSET}px)`,
              "--angle": `${(Math.atan2(dr, dc) * 180) / Math.PI}deg`,
            }}
          >
            {group.map((m) => (
              <span
                key={m.kind}
                className={s.arrow}
                data-violation={m.kind}
                style={{ background: `var(--violation-${m.kind})` }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
