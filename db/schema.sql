BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
-- TABLE: admins
-- =============================================================
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    nom_complet TEXT,
    profile TEXT,
    status TEXT NOT NULL DEFAULT 'Actif',
    archived BOOLEAN NOT NULL DEFAULT false,
    id_companie UUID,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: companies
-- =============================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    representative_name TEXT,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    full_address TEXT,
    country TEXT,
    city TEXT,
    airport_code TEXT,
    status TEXT NOT NULL DEFAULT 'Inactif',
    logo_url TEXT,
    password_hash TEXT,
    otp TEXT,
    otp_expiry TIMESTAMPTZ,
    archived BOOLEAN NOT NULL DEFAULT false,
    id_admin UUID,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: operateurs
-- =============================================================
CREATE TABLE IF NOT EXISTS public.operateurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    actif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: superviseurs
-- =============================================================
CREATE TABLE IF NOT EXISTS public.superviseurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom_complet TEXT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    telephone TEXT,
    profile TEXT,
    status TEXT NOT NULL DEFAULT 'Actif',
    archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: admin_companies
-- =============================================================
CREATE TABLE IF NOT EXISTS public.admin_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    company_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (admin_id, company_id)
);

-- =============================================================
-- TABLE: factures
-- =============================================================
CREATE TABLE IF NOT EXISTS public.factures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_facture TEXT NOT NULL UNIQUE,
    id_companie UUID NOT NULL,
    nom_client TEXT,
    objet TEXT,
    periode TEXT,
    aeroport TEXT,
    date_emission DATE,
    lieu_emission TEXT,
    montant_total NUMERIC(18,2) DEFAULT 0,
    devise TEXT DEFAULT 'XAF',
    montant_en_lettres TEXT,
    statut TEXT DEFAULT 'En attente',
    archived BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    validated_by UUID,
    validated_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: lignes_facture
-- =============================================================
CREATE TABLE IF NOT EXISTS public.lignes_facture (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_facture TEXT NOT NULL,
    description TEXT,
    quantite NUMERIC(18,2) DEFAULT 0,
    prix_unitaire NUMERIC(18,2) DEFAULT 0,
    montant NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: preuve_paiement
-- =============================================================
CREATE TABLE IF NOT EXISTS public.preuve_paiement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_facture TEXT NOT NULL,
    facture_id UUID,
    id_companie UUID,
    fichier_nom TEXT,
    fichier_url TEXT,
    file_name TEXT,
    file_url TEXT,
    type_fichier TEXT,
    commentaire TEXT,
    date_envoi TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: contestation
-- =============================================================
CREATE TABLE IF NOT EXISTS public.contestation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_companie UUID,
    numero_facture TEXT NOT NULL,
    explication TEXT,
    fichiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'En attente',
    admin_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: messages
-- =============================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_companie UUID NOT NULL,
    sender_role TEXT NOT NULL,
    content TEXT,
    admin_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: attachments
-- =============================================================
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    file_url TEXT,
    file_name TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: journal_activite
-- =============================================================
CREATE TABLE IF NOT EXISTS public.journal_activite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_activite TEXT,
    categorie TEXT,
    module TEXT,
    description TEXT,
    id_admin UUID,
    id_companie UUID,
    utilisateur_email TEXT,
    utilisateur_nom TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: archives
-- =============================================================
CREATE TABLE IF NOT EXISTS public.archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT,
    ref TEXT,
    compagnie_id UUID,
    compagnie_nom TEXT,
    montant NUMERIC(18,2),
    objet TEXT,
    periode TEXT,
    statut TEXT,
    admin_id UUID,
    admin_nom TEXT,
    date_cloture TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: parametres
-- =============================================================
CREATE TABLE IF NOT EXISTS public.parametres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL UNIQUE,
    valeur TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: invoice_counters
-- =============================================================
CREATE TABLE IF NOT EXISTS public.invoice_counters (
    id BIGSERIAL PRIMARY KEY,
    airport_code TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (airport_code, year, month)
);

-- =============================================================
-- FONCTIONS / TRIGGERS
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.invoice_counters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admins_updated_at ON public.admins;
CREATE TRIGGER trg_admins_updated_at
BEFORE UPDATE ON public.admins
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_operateurs_updated_at ON public.operateurs;
CREATE TRIGGER trg_operateurs_updated_at
BEFORE UPDATE ON public.operateurs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_superviseurs_updated_at ON public.superviseurs;
CREATE TRIGGER trg_superviseurs_updated_at
BEFORE UPDATE ON public.superviseurs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_factures_updated_at ON public.factures;
CREATE TRIGGER trg_factures_updated_at
BEFORE UPDATE ON public.factures
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_parametres_updated_at ON public.parametres;
CREATE TRIGGER trg_parametres_updated_at
BEFORE UPDATE ON public.parametres
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoice_counters_updated_at ON public.invoice_counters;
CREATE TRIGGER trg_invoice_counters_updated_at
BEFORE UPDATE ON public.invoice_counters
FOR EACH ROW EXECUTE FUNCTION public.invoice_counters_updated_at();

-- =============================================================
-- FONCTION: increment_invoice_counter
-- =============================================================
CREATE OR REPLACE FUNCTION public.increment_invoice_counter(
    p_airport_code TEXT,
    p_year INTEGER,
    p_month INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_counter INTEGER;
BEGIN
    INSERT INTO public.invoice_counters (airport_code, year, month, counter, updated_at)
    VALUES (p_airport_code, p_year, p_month, 1, now())
    ON CONFLICT (airport_code, year, month)
    DO UPDATE SET
        counter = public.invoice_counters.counter + 1,
        updated_at = now()
    RETURNING counter INTO v_counter;

    RETURN v_counter;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- RELATIONSHIPS / FOREIGN KEYS
-- =============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_companies_admin') THEN
        ALTER TABLE public.companies
            ADD CONSTRAINT fk_companies_admin
            FOREIGN KEY (id_admin) REFERENCES public.admins(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_companies_admin') THEN
        ALTER TABLE public.admin_companies
            ADD CONSTRAINT fk_admin_companies_admin
            FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_companies_company') THEN
        ALTER TABLE public.admin_companies
            ADD CONSTRAINT fk_admin_companies_company
            FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_factures_company') THEN
        ALTER TABLE public.factures
            ADD CONSTRAINT fk_factures_company
            FOREIGN KEY (id_companie) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_factures_created_by') THEN
        ALTER TABLE public.factures
            ADD CONSTRAINT fk_factures_created_by
            FOREIGN KEY (created_by) REFERENCES public.operateurs(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_factures_validated_by') THEN
        ALTER TABLE public.factures
            ADD CONSTRAINT fk_factures_validated_by
            FOREIGN KEY (validated_by) REFERENCES public.superviseurs(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lignes_facture_numero') THEN
        ALTER TABLE public.lignes_facture
            ADD CONSTRAINT fk_lignes_facture_numero
            FOREIGN KEY (numero_facture) REFERENCES public.factures(numero_facture) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_preuve_numero_facture') THEN
        ALTER TABLE public.preuve_paiement
            ADD CONSTRAINT fk_preuve_numero_facture
            FOREIGN KEY (numero_facture) REFERENCES public.factures(numero_facture) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_contestation_company') THEN
        ALTER TABLE public.contestation
            ADD CONSTRAINT fk_contestation_company
            FOREIGN KEY (id_companie) REFERENCES public.companies(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_contestation_facture') THEN
        ALTER TABLE public.contestation
            ADD CONSTRAINT fk_contestation_facture
            FOREIGN KEY (numero_facture) REFERENCES public.factures(numero_facture) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_contestation_admin') THEN
        ALTER TABLE public.contestation
            ADD CONSTRAINT fk_contestation_admin
            FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_messages_company') THEN
        ALTER TABLE public.messages
            ADD CONSTRAINT fk_messages_company
            FOREIGN KEY (id_companie) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_messages_admin') THEN
        ALTER TABLE public.messages
            ADD CONSTRAINT fk_messages_admin
            FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attachments_message') THEN
        ALTER TABLE public.attachments
            ADD CONSTRAINT fk_attachments_message
            FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_admin') THEN
        ALTER TABLE public.journal_activite
            ADD CONSTRAINT fk_journal_admin
            FOREIGN KEY (id_admin) REFERENCES public.admins(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_company') THEN
        ALTER TABLE public.journal_activite
            ADD CONSTRAINT fk_journal_company
            FOREIGN KEY (id_companie) REFERENCES public.companies(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_archives_company') THEN
        ALTER TABLE public.archives
            ADD CONSTRAINT fk_archives_company
            FOREIGN KEY (compagnie_id) REFERENCES public.companies(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_archives_admin') THEN
        ALTER TABLE public.archives
            ADD CONSTRAINT fk_archives_admin
            FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================================
-- INDEXES POUR LES REQUÊTES FRÉQUENTES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
CREATE INDEX IF NOT EXISTS idx_companies_email ON public.companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_id_admin ON public.companies(id_admin);
CREATE INDEX IF NOT EXISTS idx_factures_companie ON public.factures(id_companie);
CREATE INDEX IF NOT EXISTS idx_factures_statut ON public.factures(statut);
CREATE INDEX IF NOT EXISTS idx_factures_numero ON public.factures(numero_facture);
CREATE INDEX IF NOT EXISTS idx_lignes_facture_numero ON public.lignes_facture(numero_facture);
CREATE INDEX IF NOT EXISTS idx_preuve_facture ON public.preuve_paiement(numero_facture);
CREATE INDEX IF NOT EXISTS idx_messages_company ON public.messages(id_companie);
CREATE INDEX IF NOT EXISTS idx_messages_admin ON public.messages(admin_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_journal_company ON public.journal_activite(id_companie);
CREATE INDEX IF NOT EXISTS idx_journal_admin ON public.journal_activite(id_admin);
CREATE INDEX IF NOT EXISTS idx_archives_company ON public.archives(compagnie_id);
CREATE INDEX IF NOT EXISTS idx_admin_companies_admin ON public.admin_companies(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_companies_company ON public.admin_companies(company_id);

COMMIT;
