import { StyleUtil, type TermStyledTemplate } from '@travetto/terminal';

const input = {
  input: ['#6b8e23'], // Olive drab
  output: ['#ffc0cb'], // Pink
  path: ['#008080'], // Teal
  success: ['#00ff00'], // Green
  failure: ['#ff0000'], // Red
  param: ['#ffff00', '#daa520'], // Yellow / Goldenrod
  type: ['#00ffff'], // Teal
  description: ['#e5e5e5', '#808080'], // White / Gray
  title: ['#ffffff', '#000000'], // Bright white / black
  identifier: ['#1e90ff'], // Dodger blue
  subtitle: ['#d3d3d3', '#a9a9a9'], // Light gray / Dark Gray
  subsubtitle: ['#a9a9a9'] // Dark gray
} as const;

export const cliTpl: TermStyledTemplate<keyof typeof input> = StyleUtil.getTemplate(input);