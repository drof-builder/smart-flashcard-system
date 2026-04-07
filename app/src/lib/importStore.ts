import { ParsedCard } from './pdfParser';

let pendingCards: ParsedCard[] = [];

export function setPendingImport(cards: ParsedCard[]): void {
  pendingCards = cards;
}

export function getPendingImport(): ParsedCard[] {
  return pendingCards;
}

export function clearPendingImport(): void {
  pendingCards = [];
}
