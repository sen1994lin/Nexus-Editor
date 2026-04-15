import { useEditor } from "./use-editor";

import type { UseEditorConfig } from "./types";

export function Editor(props: UseEditorConfig) {
  const { containerRef } = useEditor(props);

  return <div ref={containerRef} />;
}
