import { Component, type ReactNode } from 'react';
import s from './MoonBoundary.module.css';

/**
 * Wraps the lazy Moon. If its code chunk fails to load, WebGL is unavailable, or the scene throws, Home keeps
 * working with a plain CSS dome of the same framing (no texture, so no imagery credit and no pin).
 */
export class MoonBoundary extends Component<{ children: ReactNode; label: string; onFail?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail?.();
  }
  render() {
    return this.state.failed ? <div className={s.fallback} role="img" aria-label={this.props.label} /> : this.props.children;
  }
}
