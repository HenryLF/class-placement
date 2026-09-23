import { useDrag } from "../../utils/dnd";
import TableShape from "../atoms/TableShape";
import Whiteboard from "../atoms/Whiteboard";
import s from "./DragPreview.module.css";

// Follows the pointer while something is being dragged.
export default function DragPreview() {
  const payload = useDrag((st) => st.payload);
  const x = useDrag((st) => st.x);
  const y = useDrag((st) => st.y);
  if (!payload) return null;

  return (
    <div
      className={s.preview}
      // A copy of the dragged item: nothing new for screen readers.
      aria-hidden
      style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
    >
      {payload.kind === "board" ? (
        <Whiteboard className={s.board} />
      ) : (
        <TableShape className={s.table} />
      )}
    </div>
  );
}
