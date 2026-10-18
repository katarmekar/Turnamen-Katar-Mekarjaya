import { ruleBodyHtml } from "@/lib/tournament-rules";

export type RulesDocumentPasal = {
  id: string;
  pasalNumber: number;
  title: string;
  description: string;
  points: unknown;
};

type RulesDocumentProps = {
  tournamentName: string;
  rulesVersion: number;
  headerEyebrow?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerMeta?: string;
  rules: RulesDocumentPasal[];
  emptyMessage?: string;
};

export function RulesDocument({
  tournamentName,
  rulesVersion,
  headerEyebrow = "Dokumen resmi",
  headerTitle = "Peraturan Turnamen",
  headerSubtitle = "",
  headerMeta = "",
  rules,
  emptyMessage = "Belum ada peraturan dari admin.",
}: RulesDocumentProps) {
  const subtitle = headerSubtitle.trim();
  const meta =
    headerMeta.trim() || `${tournamentName} · Versi ${rulesVersion}`;

  return (
    <div className="rules-doc">
      <header className="rules-doc__header">
        {headerEyebrow.trim() ? (
          <p className="rules-doc__eyebrow">{headerEyebrow.trim()}</p>
        ) : null}
        <h2 className="rules-doc__title">{headerTitle.trim() || "Peraturan Turnamen"}</h2>
        {subtitle ? (
          <p className="rules-doc__subtitle">
            {subtitle.split("\n").map((line, i) => (
              <span key={i}>
                {i > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </p>
        ) : null}
        {meta ? <p className="rules-doc__meta">{meta}</p> : null}
      </header>

      {rules.length === 0 ? (
        <p className="rules-doc__empty">{emptyMessage}</p>
      ) : (
        <div className="rules-doc__body">
          {rules.map((rule) => (
            <section key={rule.id} className="rules-pasal">
              <div className="rules-pasal__head">
                <span className="rules-pasal__badge">
                  Pasal {rule.pasalNumber}
                </span>
                <h3 className="rules-pasal__title">{rule.title}</h3>
              </div>
              <div
                className="rules-pasal__rich"
                dangerouslySetInnerHTML={{
                  __html: ruleBodyHtml(rule),
                }}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
