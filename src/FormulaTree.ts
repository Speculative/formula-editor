import * as babelPlugin from "prettier/parser-babel";
import * as estreePlugin from "prettier/plugins/estree";
import * as prettier from "prettier/standalone";

export const debugLatex = async (latex: string) => {
  const svg: SVGElement = MathJax.tex2svg(latex).querySelector("svg");

  const serializedMml: string = MathJax.tex2mml(latex);
  const mmlWrapper = document.createElement("div");
  mmlWrapper.innerHTML = serializedMml;
  const mml = mmlWrapper.querySelector("math");

  window.debugSvg = svg;
  window.debugMml = mml;

  const formattedSvg = await prettier.format(svg.outerHTML, {
    parser: "babel",
    plugins: [babelPlugin, estreePlugin],
  });

  console.log(formattedSvg);
  console.log(serializedMml);
};

window.debugLatex = debugLatex;

export const deriveFormulaTree = (
  latex: string,
): { svgSpec: FormulaSVGSpec; augmentedFormula: AugmentedFormula } => {
  latex = `\\begin{aligned}
           ${latex}
           \\end{aligned}`;
  console.log("New derivation for", latex);
  const svgSpec = deriveFormulaSVGSpec(latex);
  debugLatex(latex);
  console.log("SVG spec:", svgSpec);

  const augmentedFormula = deriveAugmentedFormula(latex, svgSpec);
  console.log(augmentedFormula);

  return {
    svgSpec,
    augmentedFormula,
  };
};

export const deriveAugmentedFormula = (
  latex: string,
  svgSpec: FormulaSVGSpec,
): AugmentedFormula => {
  const serializedMml: string = MathJax.tex2mml(latex);
  const mmlWrapper = document.createElement("div");
  mmlWrapper.innerHTML = serializedMml;
  const mml = mmlWrapper.querySelector("math");

  const root = svgSpec.root as FormulaSVGGroup;

  // return new AugmentedFormula(buildAugmentedFormulaNode(mml, root, "0"));

  return new AugmentedFormula([
    new Script(
      "0.0.0",
      new Identifier("0.0.0.0", "a"),
      undefined,
      new Numeral("0.0.0.1", 2),
    ),
    new Op("0.0.1", "+"),
    new Script(
      "0.0.2",
      new Identifier("0.0.2.0", "b"),
      undefined,
      new Numeral("0.0.2.1", 2),
    ),
    new Op("0.0.3", "="),
    new NewLine(),
    new Script(
      "0.0.4",
      new Identifier("0.0.4.0", "c"),
      undefined,
      new Numeral("0.0.4.1", 2),
    ),
  ]);
};

const buildAugmentedFormulaNode = (
  mmlNode: Element,
  svgNode: FormulaSVGSpecNode,
): AugmentedFormulaNode[] | null => {
  if (svgNode.type === "g" && svgNode.mmlNode === mmlNode.tagName) {
    if (mmlNode.tagName === "mo") {
      console.log("Matched op", mmlNode.textContent);
      return [new Op(svgNode.id, mmlNode.textContent!)];
    } else if (mmlNode.tagName === "mi") {
      console.log("Matched ident", mmlNode.textContent);
      return [new Identifier(svgNode.id, mmlNode.textContent!)];
    } else if (mmlNode.tagName === "mn") {
      console.log("Matched number", mmlNode.textContent);
      return [new Numeral(svgNode.id, parseFloat(mmlNode.textContent!))];
    } else if (mmlNode.tagName === "mfrac") {
      throw new Error("Not implemented");
    } else if (mmlNode.tagName === "msup") {
      console.log("Matching msup group...", mmlNode.innerHTML);
      const children = buildAugmentedFormulaForest(
        Array.from(mmlNode.children),
        Array.from(svgNode.children),
      );
      if (children === null) {
        return null;
      }
      const [base, sup] = children;
      return [new Script(svgNode.id, base, undefined, sup)];
    } else {
      return buildAugmentedFormulaForest(
        Array.from(mmlNode.children),
        svgNode.children,
      );
    }
  } else if (svgNode.type === "use" || svgNode.type === "rect") {
    return null;
  } else if (svgNode.type === "g") {
    console.log("Bypassing a non-mml group", svgNode);
    return buildAugmentedFormulaForest([mmlNode], svgNode.children);
  } else {
    console.log("Did not match any conditions");
    return [];
  }
};

const buildAugmentedFormulaForest = (
  mmlNodes: Element[],
  svgNodes: FormulaSVGSpecNode[],
) => {
  console.log("Trying to match", mmlNodes, "with", svgNodes);
  let children: AugmentedFormulaNode[] = [];
  let svgIndex = 0;
  for (let i = 0; i < mmlNodes.length; i++) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (svgIndex >= svgNodes.length) {
        console.log("Failed to match", mmlNodes, "with", svgNodes);
        return null;
      }

      const buildResult = buildAugmentedFormulaNode(
        mmlNodes[i],
        svgNodes[svgIndex],
      );

      if (buildResult === null) {
        svgIndex++;
      } else {
        children = children.concat(buildResult);
        break;
      }
    }
  }
  return children;
};

window.deriveFormulaTree = deriveFormulaTree;

const getAttributeOrThrow = (node: Element, attribute: string) => {
  const value = node.getAttribute(attribute);
  if (value === null) {
    throw new Error(`Attribute ${attribute} not found on ${node.nodeName}`);
  }
  return value;
};

export const deriveFormulaSVGSpec = (latex: string): FormulaSVGSpec => {
  const svg: SVGElement = MathJax.tex2svg(latex).querySelector("svg");
  const defs = Array.from(svg.querySelectorAll("defs > *")).map((def) => ({
    id: def.id,
    d: getAttributeOrThrow(def, "d"),
  }));

  const viewBox = parseViewBox(getAttributeOrThrow(svg, "viewBox"));
  const dimensions = extractSVGSize(svg);

  const contentNodes = svg.querySelectorAll(":scope > :not(defs)");
  const root = buildFormulaSVGNode(contentNodes[0], "0");
  if (contentNodes.length !== 1) {
    throw new Error("Expected exactly one non-defs child of the root svg");
  }

  return new FormulaSVGSpec(defs, root, viewBox, dimensions);
};

const buildFormulaSVGNode = (node: Element, id: string): FormulaSVGSpecNode => {
  if (node instanceof SVGGElement) {
    const children = Array.from(node.childNodes).map((child, i) =>
      buildFormulaSVGNode(child as Element, `${id}.${i}`),
    );
    const transform = extractTransform(node.transform.baseVal);
    const mmlNode = node.getAttribute("data-mml-node");
    return new FormulaSVGGroup(id, children, transform, mmlNode ?? undefined);
  } else if (node.nodeName === "use") {
    return new FormulaSVGUse(id, getAttributeOrThrow(node, "xlink:href"));
  } else if (node.nodeName === "rect") {
    return new FormulaSVGRect(
      id,
      parseFloat(getAttributeOrThrow(node, "x")),
      parseFloat(getAttributeOrThrow(node, "y")),
      parseFloat(getAttributeOrThrow(node, "width")),
      parseFloat(getAttributeOrThrow(node, "height")),
    );
  }
  console.log("Unknown node type:", node);
  throw new Error("Unknown node type");
};

const extractTransform = (transformList: SVGTransformList) => {
  const transform: FormulaSVGTransform = {};
  for (let i = 0; i < transformList.numberOfItems; i++) {
    const item = transformList.getItem(i);
    switch (item.type) {
      case SVGTransform.SVG_TRANSFORM_TRANSLATE:
        transform.translate = {
          x: item.matrix.e,
          y: item.matrix.f,
        };
        break;
      case SVGTransform.SVG_TRANSFORM_SCALE:
        transform.scale = {
          x: item.matrix.a,
          y: item.matrix.d,
        };
        break;
      default:
        throw new Error("Unknown transform type");
    }
  }
  return transform;
};

const parseViewBox = (viewBox: string) => {
  const [x, y, width, height] = viewBox.split(" ").map(parseFloat);
  return { x, y, width, height };
};

const extractSVGSize = (svg: SVGElement) => {
  const width = svg.width.baseVal.valueInSpecifiedUnits;
  const height = svg.height.baseVal.valueInSpecifiedUnits;
  const unit = SVGLengthUnit(svg.width.baseVal);
  return { width, height, unit };
};

const SVGLengthUnit = (length: SVGLength) => {
  switch (length.unitType) {
    case SVGLength.SVG_LENGTHTYPE_NUMBER:
      return "";
    case SVGLength.SVG_LENGTHTYPE_PERCENTAGE:
      return "%";
    case SVGLength.SVG_LENGTHTYPE_EMS:
      return "em";
    case SVGLength.SVG_LENGTHTYPE_EXS:
      return "ex";
    case SVGLength.SVG_LENGTHTYPE_PX:
      return "px";
    case SVGLength.SVG_LENGTHTYPE_CM:
      return "cm";
    case SVGLength.SVG_LENGTHTYPE_MM:
      return "mm";
    case SVGLength.SVG_LENGTHTYPE_IN:
      return "in";
    case SVGLength.SVG_LENGTHTYPE_PT:
      return "pt";
    case SVGLength.SVG_LENGTHTYPE_PC:
      return "pc";
    default:
      throw new Error("Unknown SVGLength unit type");
  }
};

interface AugmentedFormulaNodeBase {
  toLatex(): string;
}

export class AugmentedFormula {
  public type = "formula" as const;
  constructor(public children: AugmentedFormulaNode[]) {}

  toLatex(): string {
    return this.children.map((child) => child.toLatex()).join(" ");
  }
}

export type AugmentedFormulaNode =
  | Script
  | Fraction
  | Op
  | Identifier
  | Numeral
  | NewLine
  | AlignMarker;

export class Script implements AugmentedFormulaNodeBase {
  public type = "script" as const;
  constructor(
    public svgId: string,
    public base: AugmentedFormulaNode,
    public sub?: AugmentedFormulaNode,
    public sup?: AugmentedFormulaNode,
  ) {}

  toLatex(): string {
    return `${this.base.toLatex()}${
      this.sub ? `_{${this.sub.toLatex()}}` : ""
    }${this.sup ? `^{${this.sup.toLatex()}}` : ""}`;
  }
}

/**
 * Multiple terms separated by the same operator, e.g. `a + b + c`
 */
export class Op implements AugmentedFormulaNodeBase {
  public type = "op" as const;
  constructor(
    public svgId: string,
    public op: string,
  ) {}

  toLatex(): string {
    return this.op;
  }
}

export class Fraction implements AugmentedFormulaNodeBase {
  public type = "frac" as const;
  constructor(
    public svgId: string,
    public numerator: AugmentedFormulaNode,
    public denominator: AugmentedFormulaNode,
  ) {}

  toLatex(): string {
    return String.raw`\frac{${this.numerator.toLatex()}}{${this.denominator.toLatex()}}`;
  }
}

export class Identifier implements AugmentedFormulaNodeBase {
  public type = "ident" as const;
  constructor(
    public svgId: string,
    public name: string,
  ) {}

  toLatex(): string {
    return this.name;
  }
}

export class Numeral implements AugmentedFormulaNodeBase {
  public type = "number" as const;
  constructor(
    public svgId: string,
    public value: number,
  ) {}

  toLatex(): string {
    return this.value.toString();
  }
}

export class NewLine implements AugmentedFormulaNodeBase {
  public type = "newline" as const;
  constructor() {}

  toLatex(): string {
    return String.raw`\\`;
  }
}

export class AlignMarker implements AugmentedFormulaNodeBase {
  public type = "align" as const;
  constructor() {}

  toLatex(): string {
    return "&";
  }
}

export type FormulaSVGSpecNode =
  | FormulaSVGGroup
  | FormulaSVGUse
  | FormulaSVGRect;

export class FormulaSVGSpec {
  constructor(
    public defs: { id: string; d: string }[],
    public root: FormulaSVGSpecNode,
    public viewBox: { x: number; y: number; width: number; height: number },
    public dimensions: { width: number; height: number; unit: string },
  ) {}

  static empty(): FormulaSVGSpec {
    return new FormulaSVGSpec(
      [],
      new FormulaSVGGroup("0", [], {}),
      { x: 0, y: 0, width: 0, height: 0 },
      { width: 0, height: 0, unit: "px" },
    );
  }
}

export type FormulaSVGTransform = {
  translate?: { x: number; y: number };
  scale?: { x: number; y: number };
};

class FormulaSVGGroup {
  public type = "g" as const;

  constructor(
    public id: string,
    public children: FormulaSVGSpecNode[],
    public transform: FormulaSVGTransform,
    public mmlNode?: string,
  ) {}
}

class FormulaSVGUse {
  public type = "use" as const;

  constructor(
    public id: string,
    public linkHref: string,
  ) {}
}

class FormulaSVGRect {
  public type = "rect" as const;

  constructor(
    public id: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}
}
