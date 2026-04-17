import { POSITIVE_MOVEMENT_TYPES, NEGATIVE_MOVEMENT_TYPES } from "./constants";

const POS = POSITIVE_MOVEMENT_TYPES as readonly string[];
const NEG = NEGATIVE_MOVEMENT_TYPES as readonly string[];

export interface StockMovement {
  item_id: string;
  movement_type: string;
  quantity: number;
}

/**
 * Calcola lo stock disponibile per item a partire dai movimenti.
 * Regole:
 * - quantity nel DB e' SEMPRE memorizzato come valore POSITIVO (Math.abs).
 * - Il segno e' implicito nel movement_type:
 *   - POSITIVE_MOVEMENT_TYPES → somma
 *   - NEGATIVE_MOVEMENT_TYPES → sottrae
 *   - altri → ignorati (warning in dev)
 */
export function computeStockMap(movements: StockMovement[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of movements) {
    const qty = Math.abs(Number(m.quantity) || 0);
    if (POS.includes(m.movement_type)) {
      map.set(m.item_id, (map.get(m.item_id) || 0) + qty);
    } else if (NEG.includes(m.movement_type)) {
      map.set(m.item_id, (map.get(m.item_id) || 0) - qty);
    } else if (import.meta.env.DEV) {
      console.warn(`[stock] movement_type sconosciuto: ${m.movement_type}`);
    }
  }
  return map;
}

export function isPositiveMovement(type: string): boolean {
  return POS.includes(type);
}

export function isNegativeMovement(type: string): boolean {
  return NEG.includes(type);
}
