/** Thin ink-like runner. Compatible with authored JSON graphs.
 *  If compiled ink JSON is later dropped in, wrap it with inkjs Story instead.
 */
export interface DialogueChoice {
  id: string;
  label: string;
  divert: string;
}

export interface DialogueNode {
  id: string;
  text: string[];
  choices?: DialogueChoice[];
  tags?: string[];
}

export interface DialogueGraph {
  title: string;
  start: string;
  knots: Record<string, DialogueNode>;
}

export interface DialogueStep {
  node: DialogueNode;
  ended: boolean;
}

export function stepGraph(graph: DialogueGraph, knotId = graph.start): DialogueStep {
  const node = graph.knots[knotId];
  if (!node) throw new Error(`Нет узла ${knotId}`);
  const ended = !node.choices || node.choices.length === 0;
  return { node, ended };
}

export function choose(graph: DialogueGraph, knotId: string, choiceId: string): DialogueStep {
  const node = graph.knots[knotId];
  const choice = node.choices?.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Нет реплики ${choiceId}`);
  return stepGraph(graph, choice.divert);
}
