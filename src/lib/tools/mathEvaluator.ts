import { all, create } from 'mathjs';
import type { Tool } from './types';

// Create a sandboxed mathjs instance with all standard functions available
const math = create(all);

/**
 * Math evaluator tool — evaluates mathematical expressions safely using mathjs.
 * Supports arithmetic, algebra, trigonometry, unit conversions, statistics, and more.
 * No API key required; runs entirely client-side.
 */
export class MathEvaluatorTool implements Tool {
  readonly displayName = 'Math Evaluator';
  readonly displayDescription = 'Evaluate mathematical expressions';

  readonly definition = {
    type: 'function' as const,
    function: {
      name: 'math_evaluate',
      description:
        'Evaluate a mathematical expression and return the exact result. Use this for any calculation rather than computing it yourself. Supports arithmetic, algebra, trigonometry, unit conversions, statistical functions, and more. Examples: "2 + 2", "sqrt(144)", "sin(pi / 4)", "12 km to miles", "mean([1,2,3,4,5])", "factorial(10)".',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              'The mathematical expression to evaluate. Uses mathjs syntax. Supports: basic arithmetic (+,-,*,/,^), functions (sqrt, sin, cos, log, abs, floor, ceil, round, factorial, etc.), constants (pi, e, i), unit conversions (e.g. "5 kg to lbs"), and statistics (mean, std, variance, etc.).',
          },
        },
        required: ['expression'],
      },
    },
  };

  async execute(argsJson: string): Promise<unknown> {
    let expression: string;

    try {
      const parsed = JSON.parse(argsJson);
      expression = parsed.expression;
    } catch {
      return { error: 'Invalid arguments: could not parse JSON.' };
    }

    if (!expression || typeof expression !== 'string') {
      return { error: 'Invalid arguments: "expression" must be a non-empty string.' };
    }

    try {
      const result = math.evaluate(expression.trim());

      // Format the result to a clean string representation
      const formatted = math.format(result, { precision: 14 });

      return {
        expression: expression.trim(),
        result: formatted,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Math evaluation failed: ${message}` };
    }
  }
}
