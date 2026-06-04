# My Cookbook

My Cookbook helps people create, store, and share recipes with nutrition information. Its language distinguishes editable recipe data from generated documents meant for reading or sharing.

## Language

**Recipe Record**:
The canonical structured recipe data that the application edits and relies on for search, display, nutrition totals, and future saves.
_Avoid_: Drive doc metadata, document body, source document

**Record Name**:
A human-readable label for a Recipe Record that can change without changing Recipe Identity.
_Avoid_: Recipe identity, document name, unique key

**Recipe Document**:
A human-readable document generated from a Recipe Record for viewing or sharing outside the application.
_Avoid_: Recipe source, canonical recipe, stored recipe

**Recipe Document Template**:
The single code-owned presentation model used to generate a Recipe Document from a Recipe Record.
_Avoid_: Manual Doc formatting, document edits, Drive styling, formatting options

**Recipe Identity**:
The stable identity of a recipe, owned by its Recipe Record and preserved even if generated documents are recreated.
_Avoid_: Document identity, Google Doc ID

**Incomplete Save**:
A recipe save attempt that did not fully persist both the Recipe Record and its generated Recipe Document.
_Avoid_: Unsaved to disk, partial failure, document save error
