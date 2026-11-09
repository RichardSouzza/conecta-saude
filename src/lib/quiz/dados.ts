import bruto from '../../data/quiz.json';
import { validarQuiz } from './schema';

export const quiz = validarQuiz(bruto);
