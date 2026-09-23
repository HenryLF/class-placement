import { render } from "preact";
import { useT } from "./i18n";
import ClassRoom from "./components/organisms/ClassRoom";
import DragPreview from "./components/organisms/DragPreview";
import Pannel from "./components/organisms/Pannel";
import ClassRoomTab from "./components/pages/ClassRoomTab";
import OptionsTab from "./components/pages/OptionsTab";
import PlacementTab from "./components/pages/PlacementTab";
import StudentsTab from "./components/pages/StudentsTab";

function App() {
  const t = useT();
  return (
    <>
      <ClassRoom />
      <Pannel
        tabs={[
          { id: "classroom", label: t.tabs.classroom, Component: ClassRoomTab },
          { id: "students", label: t.tabs.students, Component: StudentsTab },
          { id: "placement", label: t.tabs.placement, Component: PlacementTab },
          { id: "options", label: "⚙", name: t.tabs.options, Component: OptionsTab },
        ]}
      />
      <DragPreview />
    </>
  );
}

render(<App />, document.getElementById("root")!);
