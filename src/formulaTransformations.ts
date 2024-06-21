import { AugmentedFormula, AugmentedFormulaNode } from "./FormulaTree";

const assertUnreachable = (x: never): never => {
  throw new Error("Non-exhaustive match for " + x);
};

export const replaceNodes = (
  formula: AugmentedFormula,
  replacer: (node: AugmentedFormulaNode) => AugmentedFormulaNode
): AugmentedFormula => {
  return fixParents(
    normalizeIds(
      new AugmentedFormula(
        formula.children.map((node) => replaceNode(node, replacer))
      )
    )
  );
};

const replaceNode = (
  node: AugmentedFormulaNode,
  replacer: (node: AugmentedFormulaNode) => AugmentedFormulaNode
): AugmentedFormulaNode => {
  switch (node.type) {
    case "script":
      return replacer(
        node.withChanges({
          base: replaceNode(node.base, replacer),
          sub: node.sub ? replaceNode(node.sub, replacer) : undefined,
          sup: node.sup ? replaceNode(node.sup, replacer) : undefined,
        })
      );
    case "frac":
      return replacer(
        node.withChanges({
          numerator: replaceNode(node.numerator, replacer),
          denominator: replaceNode(node.denominator, replacer),
        })
      );
    case "symbol":
    case "space":
      return replacer(node.withChanges({}));
    case "color":
    case "group":
    case "text":
      return replacer(
        node.withChanges({
          body: node.body.map((child) => replaceNode(child, replacer)),
        })
      );
    case "box":
      return replacer(
        node.withChanges({
          body: replaceNode(node.body, replacer),
        })
      );
    case "brace":
      return replacer(
        node.withChanges({
          base: replaceNode(node.base, replacer),
        })
      );
    case "array":
      return replacer(
        node.withChanges({
          body: node.body.map((row) =>
            row.map((cell) => replaceNode(cell, replacer))
          ),
        })
      );
  }
  return assertUnreachable(node);
};

export const normalizeIds = (formula: AugmentedFormula): AugmentedFormula => {
  // console.log("Fixing IDs", formula);
  return new AugmentedFormula(
    formula.children.map((node, i) => reassignIds(node, `${i}`))
  );
};

const reassignIds = (
  node: AugmentedFormulaNode,
  id: string
): AugmentedFormulaNode => {
  switch (node.type) {
    case "script":
      return node.withChanges({
        id,
        base: reassignIds(node.base, `${id}.base`),
        sub: node.sub ? reassignIds(node.sub, `${id}.sub`) : undefined,
        sup: node.sup ? reassignIds(node.sup, `${id}.sup`) : undefined,
      });
    case "frac":
      return node.withChanges({
        id,
        numerator: reassignIds(node.numerator, `${id}.numerator`),
        denominator: reassignIds(node.denominator, `${id}.denominator`),
      });
    case "symbol":
    case "space":
      return node.withChanges({ id });
    case "color":
    case "group":
    case "text":
      return node.withChanges({
        id,
        body: node.body.map((child, i) => reassignIds(child, `${id}.${i}`)),
      });
    case "box":
      return node.withChanges({
        id,
        body: reassignIds(node.body, `${id}.body`),
      });
    case "brace":
      return node.withChanges({
        id,
        base: reassignIds(node.base, `${id}.base`),
      });
    case "array":
      return node.withChanges({
        id,
        body: node.body.map((row, rowNum) =>
          row.map((cell, colNum) =>
            reassignIds(cell, `${id}.${rowNum}.${colNum}`)
          )
        ),
      });
  }
  return assertUnreachable(node);
};

export const fixParents = (formula: AugmentedFormula): AugmentedFormula => {
  // console.log("Fixing parents", formula);
  return new AugmentedFormula(
    formula.children.map((node) => fixParent(node, null))
  );
};

const fixParent = (
  node: AugmentedFormulaNode,
  parent: AugmentedFormulaNode | null
): AugmentedFormulaNode => {
  switch (node.type) {
    case "script":
      return node.withChanges({
        parent,
        base: fixParent(node.base, node),
        sub: node.sub ? fixParent(node.sub, node) : undefined,
        sup: node.sup ? fixParent(node.sup, node) : undefined,
      });
    case "frac":
      return node.withChanges({
        parent,
        numerator: fixParent(node.numerator, node),
        denominator: fixParent(node.denominator, node),
      });
    case "symbol":
    case "space":
      return node.withChanges({ parent });
    case "color":
    case "group":
    case "text":
      return node.withChanges({
        parent,
        body: node.body.map((child) => fixParent(child, node)),
      });
    case "box":
      return node.withChanges({
        parent,
        body: fixParent(node.body, node),
      });
    case "brace":
      return node.withChanges({
        parent,
        base: fixParent(node.base, node),
      });
    case "array":
      return node.withChanges({
        parent,
        body: node.body.map((row) => row.map((cell) => fixParent(cell, node))),
      });
  }
  return assertUnreachable(node);
};
