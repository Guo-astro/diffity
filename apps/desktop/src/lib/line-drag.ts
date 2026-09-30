import type { CommentSide, LineSelection } from '../components/comments/types';

export interface LineDrag {
  filePath: string;
  side: CommentSide;
  anchorLine: number;
  currentLine: number;
}

export function startLineDrag(filePath: string, line: number, side: CommentSide): LineDrag {
  return { filePath, side, anchorLine: line, currentLine: line };
}

/** Moves the drag's free end; a line on the other side of a split diff is ignored. */
export function extendLineDrag(drag: LineDrag | null, line: number, side: CommentSide): LineDrag | null {
  if (!drag) {
    return drag;
  }
  if (side !== drag.side || line === drag.currentLine) {
    return drag;
  }
  return { ...drag, currentLine: line };
}

export function lineDragRange(drag: LineDrag) {
  return {
    startLine: Math.min(drag.anchorLine, drag.currentLine),
    endLine: Math.max(drag.anchorLine, drag.currentLine),
    side: drag.side,
  };
}

export function isLineInDrag(drag: LineDrag | null, filePath: string, line: number, side: CommentSide) {
  if (!drag || drag.filePath !== filePath || drag.side !== side) {
    return false;
  }
  const range = lineDragRange(drag);
  return line >= range.startLine && line <= range.endLine;
}

/** The selection a finished drag produces, or null when there was no drag or it began in a file that is no longer shown. */
export function finishLineDrag(drag: LineDrag | null, filePath: string): LineSelection | null {
  if (!drag || drag.filePath !== filePath) {
    return null;
  }
  return { filePath, ...lineDragRange(drag) };
}
