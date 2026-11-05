import { Component, type ReactNode } from 'react';

interface BoundaryProps {
  onFail: (reason: string) => void;
  children: ReactNode;
}

/**
 * Catches a failed scene chunk load or a render error inside the WebGL scene
 * and reports it, so the page keeps the static composition instead of
 * unmounting. Lives outside the lazy chunk on purpose.
 */
export class SceneErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onFail(error instanceof Error ? error.message : String(error));
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
