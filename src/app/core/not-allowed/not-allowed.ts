// v1.0.0 — where scopeGuard sends a screen the user's role does not open.
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-allowed',
  imports: [RouterLink],
  templateUrl: './not-allowed.html',
})
export class NotAllowed {}
