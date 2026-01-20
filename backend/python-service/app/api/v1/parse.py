# Parse.py
from fastapi import APIRouter, HTTPException
import re as _re
from models.document import DocumentInput
from models.extraction import ExtractionResponse, Field
from services.classifier import classify_document
from utils.text_normalizer import normalize_text
from services.ocr_service import ocr_from_url
from services.bl_parser import (
    pick_best_bl,
    extract_containers,
    extract_seals,
    extract_weight,
)
from services.confidence import final_confidence
from utils.hashing import hash_text
from core.logging import get_logger

router = APIRouter()
log = get_logger()

def _extract_after_helper(text: str, key: str) -> str:
    """Helper interne pour extraire du texte après un mot-clé."""
    if not text:
        return None

    pattern = rf"{key}[\s#:\.\-]*(.+)"
    match = _re.search(pattern, text, _re.IGNORECASE)

    if match:
        return match.group(1).strip()[:240]
    return None

@router.post('/parse/document', response_model=ExtractionResponse)
async def parse_document(payload: DocumentInput):
    
    try:
        # Determine hint and only run OCR when the document was uploaded as a Bill of Lading.
        hint_raw = (payload.hint or '')
        hint = hint_raw.strip().lower()
        # Accept common hint variants (frontend sends BILL_OF_LADING)
        bl_aliases = {"bill_of_lading", "bill-of-lading", "bill of lading", "bl", "b/l", "billoflading"}

        if hint not in bl_aliases:
            # Skip OCR for non-BL documents — return a lightweight response.
            inferred = classify_document(payload.hint or '', '')
            log.info("SKIP_OCR_NOT_BL", extra={"document_id": payload.document_id, "hint": hint_raw, "inferred_type": inferred})
            return ExtractionResponse(
                document_type=inferred,
                fields=[],
                raw_text_hash='',
                raw_text_snippet='',
                extraction=None
            )

        # 1. OCR (only for BL documents)
        try:
            raw_text = ocr_from_url(payload.file_url)
        except Exception as e:
            log.error(f'Failed fetching/OCR from url: {payload.file_url}', exc_info=e)
            raw_text = ''

        ocr_text = raw_text or ''
        norm_text = normalize_text(ocr_text)

        log.info("OCR_RESULT", extra={
            "document_id": payload.document_id,
            "text_length": len(ocr_text),
            "text_preview": ocr_text[:500]
        })

        # 2. Classification / Hint
        hint = (payload.hint or '').strip().lower()
        if hint in ("bill_of_lading", "bill-of-lading", "bill of lading", "bl"):
            doc_type = "BL"
        else:
            doc_type = classify_document(payload.hint or '', norm_text)

        # 3. Detection & Extraction
        fields = []
        bl_value = None
        extraction = {}

        # BL detection: use scoring engine as single source of truth
        bl_value = pick_best_bl(norm_text)

        if bl_value:
            doc_type = 'BL'
            conf = final_confidence(ocr_text, bl_value, ['BL', 'B/L', 'BILL'])
            fields.append(Field(key='bl_number', value=bl_value, confidence=conf))
            log.info('Picked BL (scoring)', extra={'bl_value': bl_value, 'conf': conf})
            log.info('BL_DEBUG', extra={
                'document_id': payload.document_id,
                'bl_value': bl_value,
                'confidence': conf
            })

        # 4. Remplissage des détails SI c'est un BL
        # Only populate detailed BL extraction when a BL value was actually detected
        if doc_type == 'BL' and bl_value:
            extraction = {
                'status': 'parsed',
                'bl_detected': True,
                'bl_number': bl_value,
                'bl_score': conf,
                'vessel': _extract_after_helper(norm_text, 'VESSEL'),
                'voyage': _extract_after_helper(norm_text, 'VOYAGE') or _extract_after_helper(norm_text, 'VOYAGE NO'),
                'shipper': _extract_after_helper(norm_text, 'SHIPPER'),
                'consignee': _extract_after_helper(norm_text, 'CONSIGNEE'),
                'containers': extract_containers(norm_text),
                'seals': extract_seals(norm_text),
                'weight': extract_weight(norm_text)
            }

            # Date extraction
            date_match = _re.search(r'(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}|\d{4}/\d{2}/\d{2})', norm_text)
            if date_match:
                extraction['shipped_on_board_date'] = date_match.group(0)

        # If the document was classified as BL by hint but no BL value was found,
        # return a soft parsed state to aid debugging/support.
        elif doc_type == 'BL' and not bl_value:
            extraction = {
                'status': 'parsed',
                'bl_detected': False,
                'reason': 'BL_HINT_BUT_NOT_DETECTED'
            }

        elif doc_type == 'IM8':
            fields.append(Field(key='im8_ref', value='IM8_PENDING', confidence=0.5))
        
        # 5. Final Response
        # Calcul de la confiance globale
        final_conf = 0.0
        if fields:
            final_conf = max((f.confidence for f in fields), default=0.0)
        elif doc_type == 'BL' and bl_value:
            final_conf = 0.9
            
        response = ExtractionResponse(
            document_type=doc_type,
            fields=fields,
            raw_text_hash=hash_text(ocr_text),
            raw_text_snippet=ocr_text[:800],
            extraction=extraction if extraction else None
        )

        log.info(
            "PARSE_RESPONSE",
            extra={
                "document_id": payload.document_id,
                "document_type": response.document_type,
                "fields": [f.dict() for f in response.fields],
                "extraction": response.extraction,
            },
        )

        return response


    except Exception as e:
        log.exception('Unhandled exception in parse_document')
        raise HTTPException(status_code=500, detail=str(e))