"""Organizo a resposta; a conclusão já veio do motor, nunca deste arquivo."""
from .contracts import Evaluation


def format_response(result: Evaluation, *, references: bool = True, compact: bool = False) -> str:
    if result.errorCode:
        answer = result.reasoningSummary
        if references and result.matchedRules:
            answer += '\n\nBase parcial: ' + '; '.join(f'{item.id} — {item.title}' for item in result.matchedRules) + '.'
        return answer
    primary = next((item for item in result.matchedRules if item.id == result.primaryRule), None)
    if result.guidanceOptions:
        options = list(dict.fromkeys(result.guidanceOptions))
        answer = '\n\n'.join(options[:3] if compact else options)
        if compact and len(options) > 3:
            answer += f'\n\nHá mais {len(options) - 3} caminhos condicionais em Ver fundamentos.'
    elif result.decision and primary:
        answer = f'Minha recomendação é {result.decision}. {primary.message}'
        # Uma ação de aprovação de uma regra secundária não pode contradizer
        # a reprovação final. Os demais pontos continuam citados e detalhados.
        guidance = list(dict.fromkeys(item.guidance for item in result.matchedRules
            if item.severity == result.decision and item.guidance and item.guidance != item.message))
        if guidance:
            answer += '\n\n' + '\n'.join(guidance[:2] if compact else guidance)
            if compact and len(guidance) > 2:
                answer += f'\nHá mais {len(guidance) - 2} orientações em Ver fundamentos.'
        secondary = list(dict.fromkeys(item.title for item in result.matchedRules
            if item.id != result.primaryRule and not item.supportingRuleIds))
        if secondary:
            answer += '\n\nTambém considerei: ' + '; '.join(secondary[:2] if compact else secondary) + '.'
            if compact and len(secondary) > 2:
                answer += f' Outros {len(secondary) - 2} pontos estão em Ver fundamentos.'
    elif result.intent == 'hypothesis' and result.scenarioDecision:
        answer = f'Nesse cenário, a regra prevê {result.scenarioDecision}. {result.reasoningSummary}'
        if primary and primary.guidance and primary.guidance != primary.message and primary.guidance not in result.pendingInformation:
            answer += '\n\n' + primary.guidance
    else:
        answer = result.reasoningSummary
        # Uma orientação sem conclusão também precisa explicar o que fazer.
        # Nunca apresento uma ação parcial como encerramento da OS inteira.
        if primary and primary.guidance and primary.guidance != primary.message and primary.guidance not in result.pendingInformation:
            answer += '\n\n' + primary.guidance
    if result.pendingInformation:
        answer += '\n\n' + result.pendingInformation[0]
    elif not result.decision and result.outcome == 'insufficient':
        answer += ' Valide com o responsável ou descreva melhor o que foi observado na OS.'
    if references and result.matchedRules:
        answer += '\n\nBase: ' + '; '.join(f'{item.id} — {item.title}' for item in result.matchedRules) + '.'
    return answer
