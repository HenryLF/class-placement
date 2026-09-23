import { useT } from "../../i18n";
import InfoButton from "../molecules/InfoButton";
import s from "./HelpButton.module.css";

// "?" button in the panel header: a short tutorial on the app as a whole.
// Details of each control stay in its own hint or ⓘ, not here.
export default function HelpButton() {
  const t = useT();
  return (
    <InfoButton title={t.help.title} label={t.help.button} icon="?" testId="help">
      <ol className={s.steps}>
        {t.help.steps.map((step) => (
          <li key={step.title} data-testid="help-step">
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </InfoButton>
  );
}
