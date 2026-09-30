import { useState, useCallback, useRef, useEffect } from 'react';
import type { CommentSide, LineSelection } from '../components/comments/types';
import { extendLineDrag, finishLineDrag, isLineInDrag, lineDragRange, startLineDrag, type LineDrag } from '../lib/line-drag';

interface UseLineSelectionOptions {
  filePath: string;
  onSelectionComplete: (selection: LineSelection) => void;
}

interface UseLineSelectionReturn {
  selectionState: LineDrag | null;
  handleLineMouseDown: (line: number, side: CommentSide) => void;
  handleLineMouseEnter: (line: number, side: CommentSide) => void;
  isLineInSelection: (line: number, side: CommentSide) => boolean;
  getSelectionRange: () => { startLine: number; endLine: number; side: CommentSide } | null;
}

function getLineNumberFromPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y);
  if (!el) {
    return null;
  }

  const td = el.closest('td');
  if (!td) {
    return null;
  }

  const text = td.textContent?.trim();
  if (!text) {
    return null;
  }

  const num = parseInt(text, 10);
  if (isNaN(num)) {
    return null;
  }

  return num;
}

export function useLineSelection(options: UseLineSelectionOptions): UseLineSelectionReturn {
  const { filePath } = options;
  const [selectionState, setSelectionState] = useState<LineDrag | null>(null);
  const isDragging = useRef(false);
  const anchorX = useRef(0);
  const dragRef = useRef<LineDrag | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateDrag = useCallback((next: LineDrag | null) => {
    if (next === dragRef.current) {
      return;
    }
    dragRef.current = next;
    setSelectionState(next);
  }, []);

  const handleLineMouseDown = useCallback((line: number, side: CommentSide) => {
    isDragging.current = true;
    anchorX.current = 0;
    updateDrag(startLineDrag(optionsRef.current.filePath, line, side));
  }, [updateDrag]);

  const handleLineMouseEnter = useCallback((line: number, side: CommentSide) => {
    if (!isDragging.current) {
      return;
    }
    updateDrag(extendLineDrag(dragRef.current, line, side));
  }, [updateDrag]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) {
        return;
      }

      if (anchorX.current === 0) {
        anchorX.current = e.clientX;
      }

      const lineNum = getLineNumberFromPoint(anchorX.current, e.clientY);
      if (lineNum === null) {
        return;
      }
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      updateDrag(extendLineDrag(drag, lineNum, drag.side));
    };

    const handleMouseUp = () => {
      if (!isDragging.current) {
        return;
      }
      isDragging.current = false;

      const selection = finishLineDrag(dragRef.current, optionsRef.current.filePath);
      updateDrag(null);
      if (selection) {
        optionsRef.current.onSelectionComplete(selection);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateDrag]);

  const isLineInSelection = useCallback((line: number, side: CommentSide) => {
    return isLineInDrag(selectionState, filePath, line, side);
  }, [selectionState, filePath]);

  const getSelectionRange = useCallback(() => {
    if (!selectionState || selectionState.filePath !== filePath) {
      return null;
    }
    return lineDragRange(selectionState);
  }, [selectionState, filePath]);

  return {
    selectionState,
    handleLineMouseDown,
    handleLineMouseEnter,
    isLineInSelection,
    getSelectionRange,
  };
}
