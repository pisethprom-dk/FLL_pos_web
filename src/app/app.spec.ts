// v1.0.0
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';

@Component({ template: '<p>routed</p>' })
class Routed {}

describe('App', () => {
  it('renders whatever the route gives it', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([{ path: '**', component: Routed }])],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('routed');
  });
});
