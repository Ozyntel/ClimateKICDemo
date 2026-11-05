/**
 * Generic, definition-driven form editor used by /prepare.
 *
 * A section is described by FieldDef[]; RowEditor renders one object and
 * ListEditor renders an array of objects with add / remove / reorder. Nested
 * lists (pathway risks, source updates, perspectives …) use the same parts,
 * so adding a field to the lead case usually means adding one line here.
 */
import { useId, useState, type ReactNode } from "react";

export type Opt = { value: string; label: string; group?: string };

export type FieldDef<R = any, C = any> =
  | { key: string; label: string; kind: "text" | "textarea" | "date"; placeholder?: string; help?: string; wide?: boolean }
  | { key: string; label: string; kind: "number" | "nullnumber"; help?: string; min?: number; max?: number }
  | { key: string; label: string; kind: "select"; options: Opt[] | ((ctx: C, row: R) => Opt[]); help?: string }
  | { key: string; label: string; kind: "lines"; help?: string; placeholder?: string }
  | { key: string; label: string; kind: "checks"; options: Opt[] | ((ctx: C, row: R) => Opt[]); help?: string }
  | { key: string; label: string; kind: "bool"; help?: string }
  | { key: string; label: string; kind: "textfile"; nameKey?: string; help?: string }
  | { key: string; label: string; kind: "group"; fields: FieldDef<any, C>[]; help?: string }
  | { key: string; label: string; kind: "sublist"; fields: FieldDef<any, C>[]; blank: () => object; itemLabel: (x: any, i: number) => string; help?: string; addLabel?: string };

const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 10, border: "1px solid #D9D2C3", background: "#FFFFFF", font: "400 13.5px/1.4 var(--font-body)", color: "#221E2E" };
const lab: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, font: "600 12.5px/1.3 var(--font-body)", color: "#453E54", minWidth: 0 };
const helpS: React.CSSProperties = { font: "400 11.5px/1.4 var(--font-body)", color: "#8E869C" };
export const smallBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 999, border: "1.5px solid #E9E2D4", background: "#FFFFFF", color: "#221E2E", font: "600 12px/1 var(--font-body)", cursor: "pointer", whiteSpace: "nowrap" };

function opts<R, C>(o: Opt[] | ((ctx: C, row: R) => Opt[]), ctx: C, row: R): Opt[] {
  return typeof o === "function" ? o(ctx, row) : o;
}

function SelectBox({ id, value, options, onChange }: { id: string; value: string; options: Opt[]; onChange: (v: string) => void }) {
  const groups = Array.from(new Set(options.map((o) => o.group).filter(Boolean))) as string[];
  const known = options.some((o) => o.value === value);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={input}>
      {!known && <option value={value}>{value ? `${value} (not in list)` : "— choose —"}</option>}
      {options.filter((o) => !o.group).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {groups.map((g) => (<optgroup key={g} label={g}>{options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>))}
    </select>
  );
}

export function Field<R extends Record<string, any>, C>({ def, row, ctx, onChange }: { def: FieldDef<R, C>; row: R; ctx: C; onChange: (next: R) => void }) {
  const id = useId();
  const v = row[def.key];
  const set = (val: unknown) => onChange({ ...row, [def.key]: val });
  const help = "help" in def && def.help ? <span style={helpS}>{def.help}</span> : null;
  switch (def.kind) {
    case "text":
    case "date":
      return (<label style={{ ...lab, gridColumn: def.wide ? "1 / -1" : undefined }} htmlFor={id}>{def.label}<input id={id} type="text" value={v ?? ""} placeholder={def.placeholder ?? (def.kind === "date" ? "e.g. 2026-09-30 or FY2025" : "")} onChange={(e) => set(e.target.value)} style={input} />{help}</label>);
    case "textarea":
      return (<label style={{ ...lab, gridColumn: "1 / -1" }} htmlFor={id}>{def.label}<textarea id={id} value={v ?? ""} rows={3} placeholder={def.placeholder} onChange={(e) => set(e.target.value)} style={{ ...input, resize: "vertical" }} />{help}</label>);
    case "number":
    case "nullnumber":
      return (<label style={lab} htmlFor={id}>{def.label}<input id={id} type="number" min={def.min} max={def.max} value={v == null ? "" : v} placeholder={def.kind === "nullnumber" ? "Not stated" : ""} onChange={(e) => set(e.target.value === "" ? (def.kind === "nullnumber" ? null : 0) : Number(e.target.value))} style={input} />{help}</label>);
    case "select":
      return (<label style={lab} htmlFor={id}>{def.label}<SelectBox id={id} value={v ?? ""} options={opts(def.options, ctx, row)} onChange={set} />{help}</label>);
    case "lines":
      return (<label style={{ ...lab, gridColumn: "1 / -1" }} htmlFor={id}>{def.label} <span style={helpS}>(one per line)</span><textarea id={id} value={(v as string[] | undefined)?.join("\n") ?? ""} rows={3} placeholder={def.placeholder} onChange={(e) => set(e.target.value.split("\n"))} onBlur={(e) => set(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} style={{ ...input, resize: "vertical" }} />{help}</label>);
    case "bool":
      return (<label style={{ ...lab, flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} />{def.label}</label>);
    case "checks": {
      const list = opts(def.options, ctx, row), cur: string[] = Array.isArray(v) ? v : [];
      return (
        <fieldset style={{ ...lab, gridColumn: "1 / -1", border: "none", padding: 0, margin: 0 }}>
          <legend style={{ padding: 0, marginBottom: 5 }}>{def.label}</legend>
          {list.length === 0 ? <span style={helpS}>Nothing to choose from yet.</span> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {list.map((o) => { const on = cur.includes(o.value); return (
                <label key={o.value} title={o.group} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, border: "1px solid " + (on ? "#221E2E" : "#E9E2D4"), background: on ? "#221E2E" : "#FFFFFF", color: on ? "#FFFFFF" : "#453E54", font: "500 12px/1.3 var(--font-body)", cursor: "pointer" }}>
                  <input type="checkbox" checked={on} onChange={() => set(on ? cur.filter((x) => x !== o.value) : [...cur, o.value])} style={{ margin: 0 }} />{o.label}
                </label>); })}
            </div>
          )}
          {help}
        </fieldset>
      );
    }
    case "textfile":
      return (
        <label style={{ ...lab, gridColumn: "1 / -1" }} htmlFor={id}>{def.label}
          <textarea id={id} value={v ?? ""} rows={5} onChange={(e) => set(e.target.value)} style={{ ...input, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12 }} />
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <input type="file" accept=".md,.txt,text/plain,text/markdown" aria-label={`Load ${def.label} from a text file`} onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const r = new FileReader();
              r.onload = () => onChange({ ...row, [def.key]: String(r.result ?? ""), ...(def.nameKey && !row[def.nameKey] ? { [def.nameKey]: f.name } : {}) });
              r.readAsText(f);
            }} />
            <span style={helpS}>Text and Markdown only. The file stays in this browser; nothing is uploaded or analysed.</span>
          </span>
          {help}
        </label>
      );
    case "group":
      return (
        <fieldset style={{ gridColumn: "1 / -1", border: "1px dashed #E9E2D4", borderRadius: 12, padding: "10px 12px", margin: 0 }}>
          <legend style={{ font: "600 12.5px/1.3 var(--font-body)", color: "#453E54", padding: "0 4px" }}>{def.label}</legend>
          {help}
          <RowEditor fields={def.fields} row={(v ?? {}) as Record<string, any>} ctx={ctx} onChange={(nv) => set(nv)} />
        </fieldset>
      );
    case "sublist":
      return (
        <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={lab}>{def.label}</span>
          {help}
          <ListEditor fields={def.fields} rows={(v as object[] | undefined) ?? []} blank={def.blank} itemLabel={def.itemLabel} ctx={ctx} onChange={set} addLabel={def.addLabel} nested />
        </div>
      );
  }
}

export function RowEditor<R extends Record<string, any>, C>({ fields, row, ctx, onChange, aside }: { fields: FieldDef<R, C>[]; row: R; ctx: C; onChange: (next: R) => void; aside?: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: aside ? "minmax(0, 1fr) auto" : "1fr", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {fields.map((f) => <Field key={f.key} def={f} row={row} ctx={ctx} onChange={onChange} />)}
      </div>
      {aside}
    </div>
  );
}

export function ListEditor<C>({ fields, rows, blank, itemLabel, ctx, onChange, addLabel = "Add", nested, aside, emptyText }: {
  fields: FieldDef<any, C>[]; rows: object[]; blank: () => object; itemLabel: (x: any, i: number) => string; ctx: C; onChange: (rows: any[]) => void;
  addLabel?: string; nested?: boolean; aside?: (row: any) => ReactNode; emptyText?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= rows.length) return; const n = rows.slice(); [n[i], n[j]] = [n[j], n[i]]; onChange(n); setOpen(j); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.length === 0 && <span style={{ font: "italic 400 13px/1.5 var(--font-body)", color: "#8E869C" }}>{emptyText ?? "None yet."}</span>}
      {rows.map((r, i) => (
        <details key={i} open={open === i} onToggle={(e) => { const o = (e.target as HTMLDetailsElement).open; if (o) setOpen(i); else if (open === i) setOpen(null); }} style={{ border: "1px solid #E9E2D4", borderRadius: 12, background: nested ? "#FCFBF8" : "#FFFFFF" }}>
          <summary style={{ cursor: "pointer", padding: "9px 12px", font: "600 13px/1.3 var(--font-body)", color: "#221E2E", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemLabel(r, i) || <i style={{ color: "#8E869C", fontWeight: 400 }}>Untitled — fill in below</i>}</span>
          </summary>
          <div style={{ padding: "4px 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
            <RowEditor fields={fields} row={r as Record<string, any>} ctx={ctx} onChange={(nr) => { const n = rows.slice(); n[i] = nr; onChange(n); }} aside={aside ? aside(r) : undefined} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" style={smallBtn} onClick={() => move(i, -1)} disabled={i === 0}>↑ Move up</button>
              <button type="button" style={smallBtn} onClick={() => move(i, 1)} disabled={i === rows.length - 1}>↓ Move down</button>
              <button type="button" style={{ ...smallBtn, color: "#C8321B", borderColor: "#F3C7BE" }} onClick={() => { if (window.confirm("Remove this item?")) { onChange(rows.filter((_, j) => j !== i)); setOpen(null); } }}>Remove</button>
            </div>
          </div>
        </details>
      ))}
      <button type="button" style={{ ...smallBtn, alignSelf: "flex-start" }} onClick={() => { onChange([...rows, blank()]); setOpen(rows.length); }}>+ {addLabel}</button>
    </div>
  );
}
