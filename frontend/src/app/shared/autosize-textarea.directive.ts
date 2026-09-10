import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';

@Directive({
  selector: 'textarea[autosizeTextarea]',
  standalone: true,
})
export class AutosizeTextareaDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLTextAreaElement>);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private sub: Subscription | null = null;

  ngAfterViewInit() {
    const ta = this.el.nativeElement;
    ta.style.resize = 'none';
    ta.style.overflowY = 'auto';
    ta.style.boxSizing = 'border-box';
    this.resize();

    // React when ngModel updates the value (e.g. opening edit on a long card).
    this.sub = this.ngControl?.valueChanges?.subscribe(() => {
      queueMicrotask(() => this.resize());
    }) ?? null;
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  @HostListener('input')
  onInput() {
    this.resize();
  }

  @HostListener('focus')
  onFocus() {
    this.resize();
  }

  private resize() {
    const ta = this.el.nativeElement;
    const minPx = 2.5 * 16; // ~2 rows
    const maxPx = 12 * 16; // 12rem
    ta.style.height = 'auto';
    const next = Math.min(Math.max(ta.scrollHeight, minPx), maxPx);
    ta.style.height = `${next}px`;
  }
}
