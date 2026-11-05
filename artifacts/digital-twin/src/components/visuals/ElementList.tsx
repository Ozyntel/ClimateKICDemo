/**
 * ElementList — the accessible list alternative to the world map.
 *
 * Shows every configured element, team and connection with the same visual
 * vocabulary, keyboard-selectable, grouped by registry category. Used on the
 * twin page ("List view") and in the visual preview.
 */
import { CATEGORIES, getElementType } from "@/lib/visuals/registry";
import { VisualConnection, type ConnectionItem } from "./VisualConnection";
import { VisualNode, type VisualItem } from "./VisualNode";

interface Props {
  items: VisualItem[];
  connections?: ConnectionItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  changed?: Record<string, string>;
  emptyText?: string;
}

export function ElementList({ items, connections = [], selectedId, onSelect, changed = {}, emptyText = "Nothing has been added yet." }: Props) {
  if (items.length === 0 && connections.length === 0) return <p className="ozv-muted-text" style={{ margin: 0 }}>{emptyText}</p>;
  const groups = CATEGORIES.map((c) => ({ ...c, items: items.filter((i) => (getElementType(i.visual)?.category ?? "evidence-time") === c.id) })).filter((g) => g.items.length);
  return (
    <div className="ozv-list">
      {groups.map((g) => (
        <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3>{g.label} <span className="ozv-muted-text">({g.items.length})</span></h3>
          <ul className="ozv-list-grid">
            {g.items.map((it) => (
              <li key={it.id}><VisualNode item={it} selected={selectedId === it.id} onSelect={onSelect} changed={changed[it.id] ?? null} /></li>
            ))}
          </ul>
        </div>
      ))}
      {connections.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3>Connections <span className="ozv-muted-text">({connections.length})</span></h3>
          <ul className="ozv-list-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {connections.map((c) => <li key={c.id}><VisualConnection item={c} /></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
