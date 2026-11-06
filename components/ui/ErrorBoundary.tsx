"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * A wall around one part of a screen, so that part can fail on its own.
 *
 * Without it, React's answer to an error anywhere is to unmount everything:
 * a technical sheet that got a malformed answer took the shelf, the tab bar
 * and the page with it, and an installed app has no address bar to escape
 * from. With it, the card that broke says so and the rest stays where it was.
 *
 * Class-based because that is still the only way React offers to catch.
 */
export default class ErrorBoundary extends Component<
  {
    children: ReactNode;
    /** what stands in for the part that failed; nothing, if omitted */
    fallback?: ReactNode;
    /** told once, so the parent can choose a different way to show the thing */
    onError?: (error: Error) => void;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error);
    if (process.env.NODE_ENV !== "production") console.error(error, info.componentStack);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
