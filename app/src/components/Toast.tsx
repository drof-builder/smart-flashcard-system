import React from 'react';
type Props = { message: string | null; onHide: () => void };
export default function Toast({ message }: Props) {
  if (!message) return null;
  return null; // stub — Task 19 replaces this
}
