import { css } from "@emotion/react";
import { Children, useEffect, useRef } from "react";

import { observer } from "mobx-react-lite";

import {
  AugmentedFormula,
  MathSymbol,
  RenderSpec,
  Script,
  deriveAugmentedFormula,
} from "./FormulaTree";
import { formulaStore, selectionStore } from "./store";

window.testMutateFormula = () => {
  window.mutatedTimes = (window.mutatedTimes || 0) + 1;

  formulaStore.updateFormula(
    new AugmentedFormula([
      ...formulaStore.augmentedFormula.children.slice(0, -1),
      new MathSymbol(`t${window.mutatedTimes}`, "t"),
      new MathSymbol(`+${window.mutatedTimes}`, "+"),
      ...formulaStore.augmentedFormula.children.slice(-1),
    ])
  );
};

window.setFormula = (latex: string) => {
  formulaStore.updateFormula(deriveAugmentedFormula(latex));
  selectionStore.updateTargets();
};

export const RenderedFormula = observer(() => {
  useEffect(() => {
    formulaStore.updateFormula(deriveAugmentedFormula("a^2 + b^2 = c^2"));
  }, []);

  useEffect(() => {
    const resizeHandler = () => {
      selectionStore.updateTargets();
    };
    window.addEventListener("resize", resizeHandler);

    () => {
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  useEffect(() => {
    selectionStore.updateTargets();
  });

  return (
    <div
      css={css`
        transform: scale(4);
      `}
    >
      {formulaStore.renderSpec !== null && (
        <RenderedFormulaComponent spec={formulaStore.renderSpec} />
      )}
      <br />
    </div>
  );
});

const RenderedFormulaComponent = ({ spec }: { spec: RenderSpec }) => {
  return ["mjx-mi", "mjx-mn", "mjx-mo"].includes(spec.tagName) ? (
    <TargetableFormulaNode spec={spec} />
  ) : (
    <GenericFormulaNode spec={spec} />
  );
};

const GenericFormulaNode = ({ spec }: { spec: RenderSpec }) => {
  const Tag = spec.tagName;
  return (
    // TODO: React throws a seemingly harmless error about `class` vs `className`
    // @ts-expect-error This is an arbitrary tag, we can't statically type it
    <Tag id={spec.id} class={spec.className} style={spec.style} {...spec.attrs}>
      {spec.children?.map((child, i) => (
        <RenderedFormulaComponent key={child.id ?? i} spec={child} />
      ))}
    </Tag>
  );
};

const TargetableFormulaNode = observer(({ spec }: { spec: RenderSpec }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (spec.id && ref.current) {
      selectionStore.addTarget(spec.id, ref.current);
    }

    () => {
      console.log("Target cleanup running");
      if (spec.id) {
        selectionStore.removeTarget(spec.id);
      }
    };
  });

  const Tag = spec.tagName;
  return (
    // TODO: React throws a seemingly harmless error about `class` vs `className`
    // @ts-expect-error This is an arbitrary tag, we can't statically type it
    <Tag id={spec.id} class={spec.className} style={spec.style} {...spec.attrs}>
      <div
        css={css`
          display: inline-block;
          position: relative;

          ${spec.id &&
          (selectionStore.currentlyDragged.has(spec.id) ||
            selectionStore.selected.includes(spec.id))
            ? `&:after {
            position: absolute;
            content: "";
            top: -0.1rem;
            bottom: -0.1rem;
            left: -0.1rem;
            right: -0.1rem;
            outline: 1px dashed black;
          }`
            : ""}
        `}
        ref={ref}
      >
        {spec.children?.map((child, i) => (
          <RenderedFormulaComponent key={i} spec={child} />
        ))}
      </div>
    </Tag>
  );
});
