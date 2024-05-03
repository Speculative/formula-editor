import {
  IObservableArray,
  ObservableMap,
  action,
  computed,
  observable,
  reaction,
} from "mobx";

import { AugmentedFormula, RenderSpec, updateFormula } from "./FormulaTree";

class FormulaStore {
  @observable accessor renderSpec: RenderSpec | null = null;
  @observable accessor augmentedFormula: AugmentedFormula =
    new AugmentedFormula([]);
  @observable accessor suppressEditorUpdate = false;

  @action
  updateFormula(newFormula: AugmentedFormula) {
    if (this.augmentedFormula.equals(newFormula)) {
      console.log("Skipping formula update");
      return;
    }

    const { renderSpec } = updateFormula(newFormula);
    this.renderSpec = renderSpec;
    this.augmentedFormula = newFormula;
    selectionStore.clearSelection();
  }

  @computed
  get latexWithStyling() {
    return this.augmentedFormula.toLatex("noid");
  }
}
export const formulaStore = new FormulaStore();

type DimensionBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type BoundingBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export const toBoundingBox = (box: DimensionBox): BoundingBox => ({
  x1: box.left,
  y1: box.top,
  x2: box.left + box.width,
  y2: box.top + box.height,
});

export const toDimensionBox = (box: BoundingBox): DimensionBox => ({
  left: Math.min(box.x1, box.x2),
  top: Math.min(box.y1, box.y2),
  width: Math.abs(box.x1 - box.x2),
  height: Math.abs(box.y1 - box.y2),
});

class SelectionStore {
  @observable accessor workspaceBBox: DimensionBox | null = null;
  @observable accessor selected: IObservableArray<string> = observable.array();
  @observable accessor targets: ObservableMap<
    string,
    { id: string; isLeaf: boolean } & DimensionBox
  > = observable.map();
  @observable accessor selectionRect: BoundingBox | null = null;
  @observable accessor zoom = 4;
  @observable accessor pan = { x: 0, y: 0 };

  workspaceRef: Element | null = null;
  targetRefs: Map<string, [Element, boolean]> = new Map();

  @action
  initializeWorkspace(workspaceRef: Element | null) {
    this.workspaceRef = workspaceRef;

    if (!workspaceRef) {
      return;
    }

    const { left, top, width, height } = workspaceRef.getBoundingClientRect();
    this.workspaceBBox = { left, top, width, height };
  }

  @action
  updateWorkspaceDimensions() {
    if (!this.workspaceRef) {
      return;
    }

    const { left, top, width, height } =
      this.workspaceRef.getBoundingClientRect();
    this.workspaceBBox = { left, top, width, height };
  }

  @action
  addTarget(id: string, ref: Element, isLeaf: boolean) {
    this.targetRefs.set(id, [ref, isLeaf]);
  }

  @action
  removeTarget(id: string) {
    this.targetRefs.delete(id);
  }

  @action
  clearTargets() {
    console.log("Clearing targets");
    this.targetRefs.clear();
    this.targets.clear();
    this.selected.clear();
  }

  @action
  startDragSelection(x: number, y: number) {
    this.selectionRect = {
      x1: x,
      y1: y,
      x2: x,
      y2: y,
    };
  }

  @action
  updateDragSelection(x2: number, y2: number) {
    if (!this.selectionRect) {
      return;
    }
    this.selectionRect.x2 = x2;
    this.selectionRect.y2 = y2;
  }

  @action
  stopDragSelection() {
    this.currentlyDragged.forEach((id) => {
      if (!this.selected.includes(id)) {
        this.selected.push(id);
      }
    });
    this.selectionRect = null;
  }

  @action
  clearSelection() {
    this.selected.clear();
  }

  @action
  updateTargets() {
    for (const [id, [ref, isLeaf]] of this.targetRefs) {
      const { left, top, width, height } = ref.getBoundingClientRect();
      if (left === 0 && top === 0 && width === 0 && height === 0) {
        // When the formula changes, the elements with these IDs may no longer exist
        this.targets.delete(id);
      } else {
        this.targets.set(id, { id, left, top, width, height, isLeaf });
      }
    }
    console.log(this.targetRefs.size, "targets updated");
  }

  @action
  toggle(id: string) {
    if (this.selected.includes(id)) {
      this.selected = this.selected.filter((selectedId) => selectedId !== id);
    } else {
      this.selected.push(id);
    }
  }

  @action
  updatePan(dx: number, dy: number) {
    this.pan.x += dx;
    this.pan.y += dy;
  }

  @action
  updateZoom(dz: number) {
    this.zoom = Math.max(1, this.zoom + dz / 1000);
  }

  @computed
  get selectionRectDimensions() {
    if (!this.selectionRect) {
      return null;
    }

    return {
      left:
        Math.min(this.selectionRect.x1, this.selectionRect.x2) -
        (this.workspaceBBox?.left ?? 0),
      top:
        Math.min(this.selectionRect.y1, this.selectionRect.y2) -
        (this.workspaceBBox?.top ?? 0),
      width: Math.abs(this.selectionRect.x1 - this.selectionRect.x2),
      height: Math.abs(this.selectionRect!.y1 - this.selectionRect!.y2),
    };
  }

  @computed({
    equals: (a: Set<string>, b: Set<string>) =>
      a.size === b.size && Array.from(a).every((id) => b.has(id)),
  })
  get currentlyDragged(): Set<string> {
    if (!this.selectionRect) {
      return new Set();
    }

    const { x1, x2, y1, y2 } = this.selectionRect;
    const dragLeft = Math.min(x1, x2);
    const dragRight = Math.max(x1, x2);
    const dragTop = Math.min(y1, y2);
    const dragBottom = Math.max(y1, y2);

    return new Set(
      Array.from(this.targets.values()).flatMap((target) => {
        const { left, top, width, height } = target;
        const right = left + width;
        const bottom = top + height;
        return target.isLeaf &&
          left <= dragRight &&
          right >= dragLeft &&
          top <= dragBottom &&
          bottom >= dragTop
          ? [target.id]
          : [];
      })
    );
  }

  @computed({
    equals: (a: Set<string>, b: Set<string>) =>
      a.size === b.size && Array.from(a).every((id) => b.has(id)),
  })
  get resolvedSelection(): Set<string> {
    const frontier = new Set([...this.selected, ...this.currentlyDragged]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const selectedId of frontier) {
        const node = formulaStore.augmentedFormula.findNode(selectedId);
        if (!node) {
          console.error(`Node with id ${selectedId} not found`);
          continue;
        }

        if (node._parent?.children.every((child) => frontier.has(child.id))) {
          // If every child of a node is selected, the parent should be selected
          frontier.add(node._parent.id);
          node._parent.children.forEach((child) => frontier.delete(child.id));
          changed = true;
        } else if (node._parent?.children.length === 1) {
          // Selection groupings pass upwards through single-child nodes
          // e.g. if both Symbols in a Group(Color(Symbol), Color(Symbol))
          // are selected, the Group should be selected as well, ignoring that
          // the Colors are not directly selected
          frontier.add(node._parent.id);
          frontier.delete(node.id);
          changed = true;
        }
      }
    }
    return frontier;
  }
}

export const selectionStore = new SelectionStore();

// Whenever the formula changes, we'll completely rerender the formula. But the
// tree doesn't unmount, so effect cleanups for the target ref registrations
// don't run. Instead, we'll manually watch for when the rendered formula changes
// and clear the registered targets for the old formula.
//
// According to the MobX docs, reactions run synchronously after the store changes.
// reaction(
//   () => formulaStore.renderSpec,
//   () => selectionStore.clearTargets()
// );
