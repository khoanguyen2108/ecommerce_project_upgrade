import { Injectable, Logger } from '@nestjs/common';
import type { NormalizedRecommendProductsRequest } from './dto/recommend-products.dto';
import type { NormalizedStyleAdviceRequest } from './dto/style-advice.dto';

export type AiScopeEndpoint =
  | '/ai/style-advice'
  | '/ai/recommend-products'
  | '/ai/support';
export type AiScopeResult = 'allowed' | 'out_of_scope' | 'blocked';
export type AiScopeLocale = 'en' | 'vi';

export interface AiScopeDecision {
  result: AiScopeResult;
  reasonCode:
    | 'IN_SCOPE'
    | 'NO_SCOPE_MATCH'
    | 'POLITICS'
    | 'GAMBLING'
    | 'FINANCIAL_ADVICE'
    | 'MEDICAL_ADVICE'
    | 'LEGAL_ADVICE'
    | 'CODING_HELP'
    | 'UNRELATED_HOMEWORK'
    | 'PERSONAL_RELATIONSHIPS'
    | 'ADULT_CONTENT'
    | 'VIOLENCE_OR_WEAPONS'
    | 'UNRELATED_PRODUCT_OR_SERVICE'
    | 'PROMPT_INJECTION'
    | 'SECRET_EXTRACTION'
    | 'INTERNAL_DATA_REQUEST'
    | 'CROSS_CUSTOMER_DATA_REQUEST'
    | 'ADMIN_ACTION_REQUEST'
    | 'PAYMENT_INTERNALS_REQUEST'
    | 'SECURITY_BYPASS';
  locale: AiScopeLocale;
}

interface AiScopeLogContext {
  requestId?: string;
  userId?: string;
}

const VIETNAMESE_CHARACTER_PATTERN =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const VIETNAMESE_WORD_PATTERN =
  /\b(?:xin chao|giup|minh|toi|ban|don hang|giao hang|doi tra|san pham|quan ao|goi y|mac gi)\b/i;

const BLOCKED_PATTERNS: Array<{
  reasonCode: AiScopeDecision['reasonCode'];
  pattern: RegExp;
}> = [
  {
    reasonCode: 'PROMPT_INJECTION',
    pattern:
      /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|system|developer|hidden)?\s*(?:instructions?|rules?|prompts?)\b|\bjailbreak\b|\bdo anything now\b|\bdeveloper mode\b|\bbo qua (?:cac )?(?:chi dan|huong dan|quy tac)\b/i,
  },
  {
    reasonCode: 'SECRET_EXTRACTION',
    pattern:
      /\b(?:show|reveal|print|display|give|leak|expose|tell me|lay|hien thi|tiet lo)\b.{0,50}\b(?:system prompt|hidden prompt|developer message|developer instructions?|api[ _-]?keys?|secret(?:s| key)?|\.env|env(?:ironment)?(?: variables?)?|database[ _-]?url|jwt(?: secret)?|refresh token|payos (?:secret|api key|checksum)|webhook secret|admin password|credentials?|private key)\b|\b(?:system prompt|hidden prompt|developer message|api[ _-]?keys?|database[ _-]?url|jwt secret|refresh token|payos secret|webhook secret|admin password|sql dump)\b/i,
  },
  {
    reasonCode: 'CROSS_CUSTOMER_DATA_REQUEST',
    pattern:
      /\b(?:another|other|someone else(?:'s)?|all)\s+(?:customer(?:'s|s')?|user(?:'s|s')?)\s+(?:order|orders|account|data|details?)\b|\b(?:show|list|get|query|export)\s+(?:me\s+)?(?:all|every)\s+(?:customer\s+)?orders\b|\b(?:don hang|tai khoan|du lieu)\s+(?:cua nguoi khac|khach hang khac|tat ca khach hang)\b/i,
  },
  {
    reasonCode: 'INTERNAL_DATA_REQUEST',
    pattern:
      /\b(?:sql dump|dump (?:the )?database|query all users|prisma query|database schema|customer database|admin data|internal data|raw database|all user records?|source code)\b|\b(?:xuat|doc|hien thi|lay)\s+(?:toan bo )?(?:co so du lieu|du lieu noi bo|danh sach nguoi dung)\b/i,
  },
  {
    reasonCode: 'ADMIN_ACTION_REQUEST',
    pattern:
      /\b(?:act as|become|impersonate)\s+(?:an? )?(?:admin|administrator|staff)\b|\b(?:admin|administrator|staff)\s+(?:access|panel|permissions?|actions?)\b|\b(?:make|promote)\s+me\s+(?:an? )?admin\b|\b(?:cancel|refund|change|update|delete|approve)\b.{0,40}\b(?:as (?:an? )?admin|without permission|for any customer)\b/i,
  },
  {
    reasonCode: 'PAYMENT_INTERNALS_REQUEST',
    pattern:
      /\b(?:payos|payment provider|webhook|callback)\b.{0,45}\b(?:secret|signature|checksum|payload|bypass|internal|credentials?|api)\b|\b(?:fake|forge|spoof)\b.{0,30}\b(?:payment|webhook|callback)\b|\b(?:how does|explain|show|give)\b.{0,35}\b(?:payos|payment provider|webhook|payment callback)\b/i,
  },
  {
    reasonCode: 'SECURITY_BYPASS',
    pattern:
      /\b(?:hack|hacking|exploit|malware|ransomware|phishing|credential stuffing|sql injection|xss|security bypass|bypass auth|steal passwords?|ddos)\b|\b(?:tan cong|xam nhap|vuot qua xac thuc|danh cap mat khau)\b/i,
  },
];

const OUT_OF_SCOPE_PATTERNS: Array<{
  reasonCode: AiScopeDecision['reasonCode'];
  pattern: RegExp;
}> = [
  {
    reasonCode: 'POLITICS',
    pattern:
      /\b(?:politics?|political|election|president|prime minister|government|congress|parliament|democrat|republican|chinh tri|bau cu|tong thong|thu tuong|chinh phu)\b/i,
  },
  {
    reasonCode: 'GAMBLING',
    pattern:
      /\b(?:gambl(?:e|ing)|casino|sports betting|betting tips?|lottery|poker strategy|ca cuoc|danh bac|xo so)\b/i,
  },
  {
    reasonCode: 'FINANCIAL_ADVICE',
    pattern:
      /\b(?:invest(?:ment|ing)?|stock market|stocks? to buy|share price|financial advice|trading strategy|forex|crypto(?:currency)?|bitcoin|ethereum|dau tu|chung khoan|co phieu|tien ao)\b/i,
  },
  {
    reasonCode: 'MEDICAL_ADVICE',
    pattern:
      /\b(?:medical advice|health advice|diagnos(?:e|is)|medication|prescription|disease|symptoms?|rash|fever|doctor|vaccine|mental health treatment|tu van y te|chan doan|thuoc dieu tri|trieu chung|benh|bac si)\b/i,
  },
  {
    reasonCode: 'LEGAL_ADVICE',
    pattern:
      /\b(?:legal advice|legal rights?|is (?:it|this) legal|against the law|consumer law|lawyer|lawsuit|sue|court case|criminal law|legal contract|tu van phap ly|luat su|kien tung|toa an)\b/i,
  },
  {
    reasonCode: 'CODING_HELP',
    pattern:
      /\b(?:coding|programming|write (?:me )?(?:a )?(?:program|function|script|code)|debug (?:my |this )?(?:code|program)|javascript|typescript|python|java|c\+\+|react(?:js)?|node\.?(?:js)?|html|css|sql quer(?:y|ies)|api endpoint|algorithm|leetcode|lap trinh|viet code|sua loi code|giai thuat)\b/i,
  },
  {
    reasonCode: 'UNRELATED_HOMEWORK',
    pattern:
      /\b(?:homework|school assignment|write (?:my |an? )?essay|solve (?:this |the )?(?:equation|math problem)|chemistry problem|physics problem|bai tap|bai luan|giai toan|hoa hoc|vat ly)\b/i,
  },
  {
    reasonCode: 'PERSONAL_RELATIONSHIPS',
    pattern:
      /\b(?:relationship advice|boyfriend|girlfriend|dating advice|breakup|marriage advice|crush|tinh yeu|nguoi yeu|hen ho|chia tay|hon nhan)\b/i,
  },
  {
    reasonCode: 'ADULT_CONTENT',
    pattern:
      /\b(?:porn(?:ography)?|explicit sexual|sexual content|sex advice|nudes?|fetish content|noi dung khieu dam|anh khoa than)\b/i,
  },
  {
    reasonCode: 'VIOLENCE_OR_WEAPONS',
    pattern:
      /\b(?:how to (?:kill|hurt|attack)|make (?:a )?(?:bomb|weapon)|buy (?:a )?(?:gun|rifle)|weapons?|firearms?|ammunition|mass shooting|che tao bom|giet nguoi|lam vu khi|mua sung)\b/i,
  },
  {
    reasonCode: 'UNRELATED_PRODUCT_OR_SERVICE',
    pattern:
      /\b(?:recommend|compare|buy|find)\b.{0,45}\b(?:laptop|smartphone|phone plan|insurance|car|motorbike|hotel|flight|restaurant|software service)\b|\b(?:goi y|mua|tim)\b.{0,40}\b(?:dien thoai|may tinh|bao hiem|o to|khach san|chuyen bay|nha hang)\b/i,
  },
];

const STYLE_SCOPE_PATTERN =
  /\b(?:outfit|clothes?|clothing|fashion|style|styling|wear|dress|shirt|t-?shirt|tee|top|pants|trousers|jeans|skirt|jacket|coat|hoodie|sweater|cardigan|blazer|shorts|fit|fitting|loose|layers?|oversized|minimal|casual|formal|smart casual|streetwear|vintage|classic|sporty|monochrome|neutral|comfortable|elegant|color match|colour match|layering|wardrobe|occasion|wedding|party|school|work|office|going out|body type|belikeme|trang phuc|quan ao|thoi trang|phong cach|mac gi|ao|quan|vay|dam|phoi do|mau sac|vua van|di tiec|di hoc|di lam)\b/i;
const PRODUCT_SCOPE_PATTERN =
  /\b(?:recommend|suggest|find|looking for|shop|shopping|buy|product|item|catalog|in stock|available|budget|under \d|size|color|colour|category|outfit|clothes?|clothing|fashion|wear|shirt|t-?shirt|tee|top|pants|trousers|jeans|skirt|jacket|coat|hoodie|sweater|cardigan|blazer|shorts|oversized|minimal|casual|formal|belikeme|goi y|tim|mua|san pham|danh muc|con hang|ngan sach|duoi \d|size|kich co|mau|trang phuc|quan ao|thoi trang|ao|quan|vay|dam|phoi do)\b/i;
const SUPPORT_SCOPE_PATTERN =
  /\b(?:belikeme|support|help|hello|hi|shipping|delivery|return|refund|exchange|size guide|sizing|measurement|order|ordered|payment status|paid|tracking|track|package|parcel|purchase|status|handoff|human support|customer service|ho tro|xin chao|giao hang|van chuyen|doi tra|hoan tien|doi hang|bang size|kich co|don hang|thanh toan|trang thai|ma van don|nhan vien)\b/i;
const GENERIC_KNOWLEDGE_PATTERN =
  /\b(?:capital of|who (?:is|was|invented|discovered)|what year|history of|translate this|tell me a joke|weather forecast|meaning of life|thu do cua|ai la|lich su cua|dich cau nay|ke chuyen cuoi)\b/i;

@Injectable()
export class AiScopeService {
  private readonly logger = new Logger(AiScopeService.name);

  evaluateStyleAdvice(
    request: NormalizedStyleAdviceRequest,
  ): AiScopeDecision {
    const text = [
      request.occasion,
      request.style,
      request.bodyType,
      request.notes,
      ...request.preferredColors,
      ...request.preferredSizes,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');
    const comparable = this.normalizeComparable(text);
    const earlyDecision = this.classifyExplicit(text, comparable);

    if (earlyDecision) {
      return earlyDecision;
    }

    const hasStructuredStyleIntent =
      request.budget !== undefined ||
      Boolean(request.occasion) ||
      Boolean(request.style) ||
      Boolean(request.bodyType) ||
      request.preferredColors.length > 0 ||
      request.preferredSizes.length > 0;

    return this.finishClassification(
      text,
      STYLE_SCOPE_PATTERN.test(comparable) || hasStructuredStyleIntent,
    );
  }

  evaluateProductRecommendation(
    request: NormalizedRecommendProductsRequest,
  ): AiScopeDecision {
    const comparable = this.normalizeComparable(request.query);
    const earlyDecision = this.classifyExplicit(request.query, comparable);

    if (earlyDecision) {
      return earlyDecision;
    }

    const hasStructuredProductIntent =
      request.minBudget !== undefined ||
      request.maxBudget !== undefined ||
      request.categorySlugs.length > 0 ||
      request.colors.length > 0 ||
      request.sizes.length > 0;
    const hasProductTextIntent = PRODUCT_SCOPE_PATTERN.test(comparable);

    if (GENERIC_KNOWLEDGE_PATTERN.test(comparable) && !hasProductTextIntent) {
      return this.decision('out_of_scope', 'NO_SCOPE_MATCH', request.query);
    }

    return this.finishClassification(
      request.query,
      hasProductTextIntent || hasStructuredProductIntent,
    );
  }

  evaluateSupport(message: string): AiScopeDecision {
    const comparable = this.normalizeComparable(message);
    const earlyDecision = this.classifyExplicit(message, comparable);

    if (earlyDecision) {
      return earlyDecision;
    }

    return this.finishClassification(
      message,
      SUPPORT_SCOPE_PATTERN.test(comparable),
    );
  }

  logDecision(
    endpoint: AiScopeEndpoint,
    decision: AiScopeDecision,
    context: AiScopeLogContext,
  ): void {
    const fields = {
      requestId: context.requestId,
      userId: context.userId,
      endpoint,
      scopeResult: decision.result,
      reasonCode: decision.reasonCode,
    };

    this.logger.log(
      JSON.stringify({
        event:
          decision.result === 'allowed'
            ? 'AI_SCOPE_ALLOWED'
            : decision.result === 'blocked'
              ? 'AI_SCOPE_BLOCKED'
              : 'AI_SCOPE_OUT_OF_SCOPE',
        ...fields,
      }),
    );

    if (decision.result !== 'allowed') {
      const endpointEvent =
        endpoint === '/ai/style-advice'
          ? 'AI_STYLE_ADVICE_OUT_OF_SCOPE'
          : endpoint === '/ai/recommend-products'
            ? 'AI_RECOMMEND_PRODUCTS_OUT_OF_SCOPE'
            : 'AI_SUPPORT_OUT_OF_SCOPE';

      this.logger.log(JSON.stringify({ event: endpointEvent, ...fields }));
    }
  }

  private classifyExplicit(
    originalText: string,
    comparable: string,
  ): AiScopeDecision | undefined {
    for (const entry of BLOCKED_PATTERNS) {
      if (entry.pattern.test(comparable)) {
        return this.decision('blocked', entry.reasonCode, originalText);
      }
    }

    for (const entry of OUT_OF_SCOPE_PATTERNS) {
      if (entry.pattern.test(comparable)) {
        return this.decision('out_of_scope', entry.reasonCode, originalText);
      }
    }

    return undefined;
  }

  private finishClassification(
    originalText: string,
    inScope: boolean,
  ): AiScopeDecision {
    return this.decision(
      inScope ? 'allowed' : 'out_of_scope',
      inScope ? 'IN_SCOPE' : 'NO_SCOPE_MATCH',
      originalText,
    );
  }

  private decision(
    result: AiScopeResult,
    reasonCode: AiScopeDecision['reasonCode'],
    originalText: string,
  ): AiScopeDecision {
    return {
      result,
      reasonCode,
      locale: this.detectLocale(originalText),
    };
  }

  private detectLocale(value: string): AiScopeLocale {
    return VIETNAMESE_CHARACTER_PATTERN.test(value) ||
      VIETNAMESE_WORD_PATTERN.test(this.normalizeComparable(value))
      ? 'vi'
      : 'en';
  }

  private normalizeComparable(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLocaleLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}
