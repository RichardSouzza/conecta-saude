import release from '../../../release.config.json';
import { modoTeste } from '../conteudo';
import { quiz } from './dados';
import { quizPublicavel } from './publicacao';

export const quizDisponivel = quizPublicavel({ modoTeste, estagio: release.estagio, status: quiz.status });
