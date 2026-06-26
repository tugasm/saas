--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.4

-- Started on 2026-06-04 23:09:07 WIB

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 71 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- TOC entry 3972 (class 0 OID 0)
-- Dependencies: 71
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 350 (class 1259 OID 17512)
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id bigint NOT NULL,
    user_id bigint,
    action text,
    description text,
    ip_address text,
    created_at timestamp with time zone
);


--
-- TOC entry 351 (class 1259 OID 17517)
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3973 (class 0 OID 0)
-- Dependencies: 351
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- TOC entry 376 (class 1259 OID 18851)
-- Name: attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendances (
    id bigint NOT NULL,
    user_id bigint,
    date date,
    clock_in timestamp with time zone,
    clock_out timestamp with time zone,
    duration_h numeric,
    daily_wage numeric,
    status text,
    notes text,
    employee_id bigint
);


--
-- TOC entry 375 (class 1259 OID 18850)
-- Name: attendances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3974 (class 0 OID 0)
-- Dependencies: 375
-- Name: attendances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendances_id_seq OWNED BY public.attendances.id;


--
-- TOC entry 352 (class 1259 OID 17518)
-- Name: cash_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_flows (
    id bigint NOT NULL,
    type text,
    amount numeric,
    description text,
    evidence text,
    created_by bigint,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    category text
);


--
-- TOC entry 353 (class 1259 OID 17523)
-- Name: cash_flows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_flows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3975 (class 0 OID 0)
-- Dependencies: 353
-- Name: cash_flows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_flows_id_seq OWNED BY public.cash_flows.id;


--
-- TOC entry 374 (class 1259 OID 18836)
-- Name: employee_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_configs (
    user_id bigint NOT NULL,
    device_user_id text,
    hourly_rate numeric,
    "position" text,
    join_date timestamp with time zone
);


--
-- TOC entry 373 (class 1259 OID 18835)
-- Name: employee_configs_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_configs_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3976 (class 0 OID 0)
-- Dependencies: 373
-- Name: employee_configs_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_configs_user_id_seq OWNED BY public.employee_configs.user_id;


--
-- TOC entry 384 (class 1259 OID 34996)
-- Name: employee_loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_loans (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    remaining_amount double precision DEFAULT 0 NOT NULL,
    reason text,
    status character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- TOC entry 383 (class 1259 OID 34995)
-- Name: employee_loans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_loans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3977 (class 0 OID 0)
-- Dependencies: 383
-- Name: employee_loans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_loans_id_seq OWNED BY public.employee_loans.id;


--
-- TOC entry 378 (class 1259 OID 18866)
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id bigint NOT NULL,
    name text,
    phone text,
    "position" text,
    device_user_id text,
    hourly_rate numeric,
    join_date timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- TOC entry 377 (class 1259 OID 18865)
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3978 (class 0 OID 0)
-- Dependencies: 377
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- TOC entry 354 (class 1259 OID 17524)
-- Name: ledgers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledgers (
    id bigint NOT NULL,
    date timestamp with time zone,
    type text,
    category text,
    amount numeric,
    description text,
    reference text,
    created_by bigint,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- TOC entry 355 (class 1259 OID 17529)
-- Name: ledgers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ledgers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3979 (class 0 OID 0)
-- Dependencies: 355
-- Name: ledgers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ledgers_id_seq OWNED BY public.ledgers.id;


--
-- TOC entry 356 (class 1259 OID 17530)
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    id bigint NOT NULL,
    user_id bigint,
    vehicle_id bigint,
    status text DEFAULT 'pending'::text,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    transaction_id bigint,
    reminder_sent boolean DEFAULT false,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    package_id bigint
);


--
-- TOC entry 357 (class 1259 OID 17537)
-- Name: memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.memberships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3980 (class 0 OID 0)
-- Dependencies: 357
-- Name: memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.memberships_id_seq OWNED BY public.memberships.id;


--
-- TOC entry 358 (class 1259 OID 17538)
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id bigint NOT NULL,
    name text,
    type text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- TOC entry 359 (class 1259 OID 17544)
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_methods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3981 (class 0 OID 0)
-- Dependencies: 359
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- TOC entry 386 (class 1259 OID 35016)
-- Name: payrolls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payrolls (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    total_hours double precision DEFAULT 0,
    base_salary double precision DEFAULT 0,
    loan_deduction double precision DEFAULT 0,
    bonus double precision DEFAULT 0,
    net_salary double precision DEFAULT 0,
    status character varying(255),
    payment_date timestamp with time zone
);


--
-- TOC entry 385 (class 1259 OID 35015)
-- Name: payrolls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payrolls_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3982 (class 0 OID 0)
-- Dependencies: 385
-- Name: payrolls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payrolls_id_seq OWNED BY public.payrolls.id;


--
-- TOC entry 360 (class 1259 OID 17545)
-- Name: point_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_configs (
    id bigint NOT NULL,
    points_per_rupiah numeric,
    min_transaction_rp numeric,
    membership_points_rp numeric,
    updated_at timestamp with time zone,
    membership_points_awarded bigint,
    membership_price numeric
);


--
-- TOC entry 361 (class 1259 OID 17550)
-- Name: point_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.point_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3983 (class 0 OID 0)
-- Dependencies: 361
-- Name: point_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.point_configs_id_seq OWNED BY public.point_configs.id;


--
-- TOC entry 372 (class 1259 OID 18827)
-- Name: role_accesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_accesses (
    role text NOT NULL,
    menus text
);


--
-- TOC entry 388 (class 1259 OID 43127)
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id bigint NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'service'::text,
    sort_order bigint DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- TOC entry 387 (class 1259 OID 43125)
-- Name: service_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3984 (class 0 OID 0)
-- Dependencies: 387
-- Name: service_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_categories_id_seq OWNED BY public.service_categories.id;


--
-- TOC entry 362 (class 1259 OID 17551)
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id bigint NOT NULL,
    category text,
    name text,
    description text,
    price numeric,
    duration bigint,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    points_awarded bigint DEFAULT 0,
    member_discount_pct numeric,
    duration_months bigint,
    points_price integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 363 (class 1259 OID 17557)
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.services_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3985 (class 0 OID 0)
-- Dependencies: 363
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- TOC entry 364 (class 1259 OID 17558)
-- Name: transaction_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_items (
    id bigint NOT NULL,
    transaction_id bigint,
    service_id bigint,
    quantity bigint,
    price numeric,
    subtotal numeric,
    created_at timestamp with time zone,
    base_price numeric,
    discount_amount numeric,
    final_price numeric,
    name character varying(255) DEFAULT ''::character varying NOT NULL
);


--
-- TOC entry 365 (class 1259 OID 17563)
-- Name: transaction_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transaction_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3986 (class 0 OID 0)
-- Dependencies: 365
-- Name: transaction_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transaction_items_id_seq OWNED BY public.transaction_items.id;


--
-- TOC entry 366 (class 1259 OID 17564)
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id bigint NOT NULL,
    user_id bigint,
    transaction_code text,
    total_amount numeric,
    points_earned bigint,
    status text DEFAULT 'pending'::text,
    payment_method_id bigint,
    payment_type text,
    xendit_invoice_id text,
    xendit_payment_url text,
    paid_at timestamp with time zone,
    cashier_id bigint,
    notes text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    deleted_at timestamp without time zone,
    points_used integer DEFAULT 0 NOT NULL,
    vehicle_id integer,
    tx_type character varying(50) DEFAULT 'service'::character varying NOT NULL,
    reference_id bigint,
    snap_token text,
    raw_notification text
);


--
-- TOC entry 367 (class 1259 OID 17570)
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3987 (class 0 OID 0)
-- Dependencies: 367
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- TOC entry 368 (class 1259 OID 17571)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    google_id text,
    email text,
    name text,
    phone text,
    photo text,
    role text DEFAULT 'customer'::text,
    points bigint DEFAULT 0,
    password text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    address text DEFAULT ''::text NOT NULL,
    birth_place character varying(255) DEFAULT ''::character varying NOT NULL,
    birth_date date,
    gender character varying(10) DEFAULT ''::character varying NOT NULL,
    fcm_token text,
    CONSTRAINT users_gender_check CHECK (((gender)::text = ANY ((ARRAY[''::character varying, 'male'::character varying, 'female'::character varying])::text[])))
);


--
-- TOC entry 369 (class 1259 OID 17579)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3988 (class 0 OID 0)
-- Dependencies: 369
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 370 (class 1259 OID 17580)
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id bigint NOT NULL,
    user_id bigint,
    type text,
    brand text,
    model text,
    year bigint,
    color text,
    license_plate text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- TOC entry 371 (class 1259 OID 17585)
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehicles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3989 (class 0 OID 0)
-- Dependencies: 371
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- TOC entry 3665 (class 2604 OID 17586)
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- TOC entry 3693 (class 2604 OID 18854)
-- Name: attendances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances ALTER COLUMN id SET DEFAULT nextval('public.attendances_id_seq'::regclass);


--
-- TOC entry 3666 (class 2604 OID 17587)
-- Name: cash_flows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows ALTER COLUMN id SET DEFAULT nextval('public.cash_flows_id_seq'::regclass);


--
-- TOC entry 3692 (class 2604 OID 18839)
-- Name: employee_configs user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_configs ALTER COLUMN user_id SET DEFAULT nextval('public.employee_configs_user_id_seq'::regclass);


--
-- TOC entry 3696 (class 2604 OID 34999)
-- Name: employee_loans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_loans ALTER COLUMN id SET DEFAULT nextval('public.employee_loans_id_seq'::regclass);


--
-- TOC entry 3694 (class 2604 OID 18869)
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- TOC entry 3667 (class 2604 OID 17588)
-- Name: ledgers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledgers ALTER COLUMN id SET DEFAULT nextval('public.ledgers_id_seq'::regclass);


--
-- TOC entry 3668 (class 2604 OID 17589)
-- Name: memberships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships ALTER COLUMN id SET DEFAULT nextval('public.memberships_id_seq'::regclass);


--
-- TOC entry 3671 (class 2604 OID 17590)
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- TOC entry 3699 (class 2604 OID 35019)
-- Name: payrolls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls ALTER COLUMN id SET DEFAULT nextval('public.payrolls_id_seq'::regclass);


--
-- TOC entry 3673 (class 2604 OID 17591)
-- Name: point_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_configs ALTER COLUMN id SET DEFAULT nextval('public.point_configs_id_seq'::regclass);


--
-- TOC entry 3705 (class 2604 OID 43130)
-- Name: service_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories ALTER COLUMN id SET DEFAULT nextval('public.service_categories_id_seq'::regclass);


--
-- TOC entry 3674 (class 2604 OID 17592)
-- Name: services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- TOC entry 3678 (class 2604 OID 17593)
-- Name: transaction_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_items ALTER COLUMN id SET DEFAULT nextval('public.transaction_items_id_seq'::regclass);


--
-- TOC entry 3680 (class 2604 OID 17594)
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- TOC entry 3684 (class 2604 OID 17595)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3691 (class 2604 OID 17596)
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- TOC entry 3932 (class 0 OID 17512)
-- Dependencies: 350
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.activity_logs VALUES (1, 1, 'login', 'Admin logged in', '::1', '2025-11-15 14:39:59.612301+00');
INSERT INTO public.activity_logs VALUES (2, 1, 'login', 'Admin logged in', '::1', '2025-11-15 16:12:24.892275+00');
INSERT INTO public.activity_logs VALUES (3, 1, 'update_service', 'Updated service: Wash & Wax', '::1', '2025-11-15 16:13:08.638239+00');
INSERT INTO public.activity_logs VALUES (4, 1, 'cash_in', 'Cash in: Rp100000.00 - belanja', '::1', '2025-11-15 16:13:57.276234+00');
INSERT INTO public.activity_logs VALUES (5, 1, 'login', 'Admin logged in', '::1', '2025-11-15 16:15:33.27798+00');
INSERT INTO public.activity_logs VALUES (6, 1, 'manual_checkout', 'Manual checkout: TRXfbU4ZhEH1763223344 - Rp75000.00', '::1', '2025-11-15 16:15:44.867238+00');
INSERT INTO public.activity_logs VALUES (7, 1, 'login', 'Admin logged in', '::1', '2025-11-22 04:43:20.180446+00');
INSERT INTO public.activity_logs VALUES (8, 1, 'login', 'Admin logged in', '::1', '2025-11-22 04:43:29.50637+00');
INSERT INTO public.activity_logs VALUES (9, 1, 'login', 'Admin logged in', '::1', '2025-11-22 04:43:41.806767+00');
INSERT INTO public.activity_logs VALUES (10, 1, 'login', 'Admin logged in', '::1', '2025-11-22 04:44:47.024867+00');
INSERT INTO public.activity_logs VALUES (11, 1, 'login', 'Admin logged in', '::1', '2025-11-22 04:45:43.060839+00');
INSERT INTO public.activity_logs VALUES (12, 1, 'login', 'Admin logged in', '::1', '2025-11-22 04:48:54.004557+00');
INSERT INTO public.activity_logs VALUES (13, 1, 'manual_checkout', 'Manual checkout: TRXk4LMHM_P1763787148 - Rp50000.00', '::1', '2025-11-22 04:52:29.032028+00');
INSERT INTO public.activity_logs VALUES (14, 1, 'login', 'Admin logged in', '::1', '2025-11-22 14:17:29.21625+00');
INSERT INTO public.activity_logs VALUES (15, 1, 'login', 'Admin logged in', '::1', '2025-11-22 14:35:02.145113+00');
INSERT INTO public.activity_logs VALUES (16, 1, 'login', 'Admin logged in', '::1', '2025-11-22 14:35:10.511665+00');
INSERT INTO public.activity_logs VALUES (17, 1, 'login', 'Admin logged in', '139.193.72.68', '2025-11-22 14:50:58.293307+00');
INSERT INTO public.activity_logs VALUES (18, 1, 'login', 'Admin logged in', '139.193.72.68', '2025-11-22 15:19:58.222401+00');
INSERT INTO public.activity_logs VALUES (19, 1, 'login', 'Admin logged in', '118.99.106.15', '2025-11-22 15:31:06.878716+00');
INSERT INTO public.activity_logs VALUES (20, 1, 'login', 'Admin logged in', '157.85.209.12', '2025-11-26 16:27:15.55723+00');
INSERT INTO public.activity_logs VALUES (21, 1, 'update_transaction', 'Updated transaction TRXqacfNF541764177205 to paid', '157.85.209.12', '2025-11-26 18:58:15.499497+00');
INSERT INTO public.activity_logs VALUES (22, 1, 'manual_checkout', 'Manual checkout: TRX9MwY0HC81764184229 - Rp100000.00', '157.85.209.12', '2025-11-26 19:10:31.800583+00');
INSERT INTO public.activity_logs VALUES (23, 1, 'login', 'Admin logged in', '157.85.209.12', '2025-11-27 01:24:41.705847+00');
INSERT INTO public.activity_logs VALUES (24, 1, 'update_transaction', 'Updated transaction TRXhUXc86x-1764208891 to paid', '157.85.209.12', '2025-11-27 02:01:45.053684+00');
INSERT INTO public.activity_logs VALUES (25, 1, 'login', 'Admin logged in', '157.85.209.12', '2025-11-27 02:51:42.718146+00');
INSERT INTO public.activity_logs VALUES (26, 1, 'login', 'Admin logged in', '182.2.141.152', '2025-11-27 04:05:15.951396+00');
INSERT INTO public.activity_logs VALUES (27, 1, 'manual_checkout', 'Manual checkout: TRXA7CH-zAM1764216553 - Rp35000.00', '157.85.209.12', '2025-11-27 04:09:15.088079+00');
INSERT INTO public.activity_logs VALUES (28, 1, 'manual_checkout', 'Manual checkout: TRXlVh0aZE21764216592 - Rp35000.00', '157.85.209.12', '2025-11-27 04:09:53.960486+00');
INSERT INTO public.activity_logs VALUES (29, 1, 'manual_checkout', 'Manual checkout: TRXZCqK2qex1764217300 - Rp35000.00', '157.85.209.12', '2025-11-27 04:21:42.092295+00');
INSERT INTO public.activity_logs VALUES (30, 1, 'manual_checkout', 'Manual checkout: TRX4g9VBzUz1764217380 - Rp50000.00', '157.85.209.12', '2025-11-27 04:23:01.818172+00');
INSERT INTO public.activity_logs VALUES (31, 1, 'manual_checkout', 'Manual checkout: TRXvZTwv0ZC1764218341 - Rp50000.00', '157.85.209.12', '2025-11-27 04:39:02.510061+00');
INSERT INTO public.activity_logs VALUES (32, 1, 'login', 'Admin logged in', '157.85.209.12', '2025-11-27 04:39:33.672379+00');
INSERT INTO public.activity_logs VALUES (33, 1, 'cash_out', 'Cash out: Rp200000.00 - beli sabun', '157.85.209.12', '2025-11-27 04:41:10.252836+00');
INSERT INTO public.activity_logs VALUES (34, 1, 'login', 'Admin logged in', '157.85.209.12', '2025-11-27 05:42:42.353325+00');
INSERT INTO public.activity_logs VALUES (35, 1, 'login', 'Admin logged in', '157.85.209.12', '2025-11-27 05:57:17.510059+00');
INSERT INTO public.activity_logs VALUES (36, 1, 'login', 'Admin logged in', '157.85.209.12', '2025-11-27 06:09:20.97326+00');
INSERT INTO public.activity_logs VALUES (37, 1, 'manual_checkout', 'Manual checkout: TRXo-8cpDX91764224628 - Rp100000.00', '157.85.209.12', '2025-11-27 06:23:50.774333+00');
INSERT INTO public.activity_logs VALUES (38, 1, 'update_transaction', 'Updated transaction TRXsFpNxbkc1764226195 to cancelled', '157.85.209.12', '2025-11-27 06:54:16.356133+00');
INSERT INTO public.activity_logs VALUES (39, 1, 'login', 'Admin logged in', '157.85.209.47', '2025-11-29 11:11:01.60506+00');
INSERT INTO public.activity_logs VALUES (40, 1, 'login', 'Admin logged in', '157.85.209.47', '2025-11-29 11:22:16.769767+00');
INSERT INTO public.activity_logs VALUES (41, 8, 'login', 'Admin logged in', '157.85.209.47', '2025-11-29 11:26:20.342399+00');
INSERT INTO public.activity_logs VALUES (42, 1, 'login', 'Admin logged in', '157.85.209.47', '2025-11-29 11:43:48.072476+00');
INSERT INTO public.activity_logs VALUES (43, 1, 'update_config', 'Updated point configuration', '157.85.209.47', '2025-11-29 11:45:47.898358+00');
INSERT INTO public.activity_logs VALUES (44, 1, 'update_service', 'Updated service: Fast Wash', '157.85.209.47', '2025-11-29 11:53:49.714053+00');
INSERT INTO public.activity_logs VALUES (45, 1, 'update_service', 'Updated service: Fast Wash', '157.85.209.47', '2025-11-29 11:53:55.900285+00');
INSERT INTO public.activity_logs VALUES (46, 1, 'update_service', 'Updated service: Regular Wash', '157.85.209.47', '2025-11-29 11:54:08.330506+00');
INSERT INTO public.activity_logs VALUES (47, 1, 'update_transaction', 'Updated transaction TRX1RFajPrQ1764226481 to cancelled', '157.85.209.47', '2025-11-29 13:32:52.582775+00');
INSERT INTO public.activity_logs VALUES (48, 1, 'update_transaction', 'Updated transaction TRXj8Z5bPEQ1764423189 to paid', '157.85.209.47', '2025-11-29 13:33:28.600618+00');
INSERT INTO public.activity_logs VALUES (49, 1, 'manual_checkout', 'Manual checkout: TRXixiBVXw01764425106 - Rp25000.00', '157.85.209.47', '2025-11-29 14:05:08.223324+00');
INSERT INTO public.activity_logs VALUES (50, 1, 'manual_checkout', 'Manual checkout: TRXZKa-3nQt1764425138 - Rp50000.00', '157.85.209.47', '2025-11-29 14:05:40.074458+00');
INSERT INTO public.activity_logs VALUES (51, 8, 'login', 'Admin logged in', '158.140.182.103', '2025-11-29 14:39:04.652709+00');
INSERT INTO public.activity_logs VALUES (52, 1, 'manual_checkout', 'Manual checkout: TRXa5odDPx71764428042 - Rp25000.00', '157.85.209.47', '2025-11-29 14:54:04.587048+00');
INSERT INTO public.activity_logs VALUES (53, 1, 'manual_checkout', 'Manual checkout: TRX85L9FVpS1764428067 - Rp25000.00', '157.85.209.47', '2025-11-29 14:54:28.975166+00');
INSERT INTO public.activity_logs VALUES (54, 1, 'update_transaction', 'Updated transaction TRXKMgEs6cM1764428000 to paid', '157.85.209.47', '2025-11-29 17:14:54.458461+00');
INSERT INTO public.activity_logs VALUES (55, 1, 'update_transaction', 'Updated transaction TRXOee43tif1764427981 to paid', '157.85.209.47', '2025-11-29 17:15:10.362067+00');
INSERT INTO public.activity_logs VALUES (56, 8, 'login', 'Admin logged in', '158.140.182.103', '2025-11-30 00:36:34.553763+00');
INSERT INTO public.activity_logs VALUES (57, 1, 'login', 'Admin logged in', '158.140.182.103', '2025-11-30 00:38:13.32964+00');
INSERT INTO public.activity_logs VALUES (58, 1, 'login', 'Admin logged in', '157.85.209.47', '2025-11-30 04:01:32.183492+00');
INSERT INTO public.activity_logs VALUES (59, 1, 'login', 'Admin logged in', '182.2.179.49', '2025-11-30 14:14:04.750602+00');
INSERT INTO public.activity_logs VALUES (60, 1, 'login', 'Admin logged in', '158.140.182.103', '2025-12-06 04:04:25.553989+00');
INSERT INTO public.activity_logs VALUES (61, 1, 'login', 'Admin logged in', '::1', '2026-01-27 15:26:21.51698+00');
INSERT INTO public.activity_logs VALUES (62, 1, 'login', 'Admin logged in', '::1', '2026-01-27 15:41:17.500532+00');
INSERT INTO public.activity_logs VALUES (63, 1, 'login', 'Admin logged in', '::1', '2026-04-08 08:33:12.356514+00');
INSERT INTO public.activity_logs VALUES (64, 1, 'login', 'Admin logged in', '180.252.89.75', '2026-04-08 14:16:28.942697+00');
INSERT INTO public.activity_logs VALUES (65, 14, 'login', 'Admin logged in', '180.252.89.75', '2026-04-08 14:25:46.636892+00');
INSERT INTO public.activity_logs VALUES (66, 14, 'login', 'Admin logged in', '180.252.89.75', '2026-04-08 14:42:40.072047+00');
INSERT INTO public.activity_logs VALUES (67, 1, 'login', 'Admin logged in', '180.252.89.75', '2026-04-08 14:43:50.887798+00');
INSERT INTO public.activity_logs VALUES (68, 1, 'login', 'Admin logged in', '180.252.89.75', '2026-04-08 14:45:35.067657+00');
INSERT INTO public.activity_logs VALUES (69, 14, 'login', 'Admin logged in', '180.252.89.75', '2026-04-08 14:52:45.813+00');
INSERT INTO public.activity_logs VALUES (70, 1, 'login', 'Admin logged in', '180.252.89.75', '2026-04-08 14:56:19.927361+00');
INSERT INTO public.activity_logs VALUES (71, 1, 'delete_service', 'Deleted service ID: 9', '180.252.89.75', '2026-04-08 15:21:15.453481+00');
INSERT INTO public.activity_logs VALUES (72, 1, 'update_service', 'Updated service: Member Motor 1 Bulan', '180.252.89.75', '2026-04-08 15:21:58.537099+00');
INSERT INTO public.activity_logs VALUES (73, 1, 'update_service', 'Updated service: Member Mobil 1 Bulan', '180.252.89.75', '2026-04-08 15:22:26.122121+00');
INSERT INTO public.activity_logs VALUES (74, 1, 'update_service', 'Updated service: Fast Wash', '180.252.89.75', '2026-04-08 15:23:01.952987+00');
INSERT INTO public.activity_logs VALUES (75, 1, 'update_service', 'Updated service: Fast Wash', '180.252.89.75', '2026-04-08 15:23:13.36843+00');
INSERT INTO public.activity_logs VALUES (76, 1, 'login', 'Admin logged in', '180.252.89.75', '2026-04-08 15:40:06.105021+00');
INSERT INTO public.activity_logs VALUES (77, 14, 'login', 'Admin logged in', '158.140.182.103', '2026-04-09 00:17:02.717806+00');
INSERT INTO public.activity_logs VALUES (78, 14, 'login', 'Admin logged in', '182.6.165.121', '2026-04-09 08:33:46.026476+00');
INSERT INTO public.activity_logs VALUES (79, 1, 'login', 'Admin logged in', '180.252.94.83', '2026-04-10 22:57:41.824661+00');
INSERT INTO public.activity_logs VALUES (80, 1, 'login', 'Admin logged in', '180.252.83.5', '2026-04-19 14:59:35.380375+00');
INSERT INTO public.activity_logs VALUES (81, 1, 'login', 'Admin logged in', '180.252.83.5', '2026-04-19 15:07:11.613184+00');
INSERT INTO public.activity_logs VALUES (82, 1, 'login', 'Admin logged in', '180.252.83.5', '2026-04-19 15:08:31.767245+00');
INSERT INTO public.activity_logs VALUES (83, 1, 'login', 'Admin logged in', '125.160.251.97', '2026-05-14 08:18:57.363235+00');
INSERT INTO public.activity_logs VALUES (84, 1, 'login', 'Admin logged in', '182.2.185.49', '2026-05-14 08:56:19.369941+00');
INSERT INTO public.activity_logs VALUES (85, 1, 'update_service', 'Updated service: Member Mobil 1 Bulan', '125.160.251.97', '2026-05-14 10:01:34.611821+00');
INSERT INTO public.activity_logs VALUES (86, 1, 'login', 'Admin logged in', '180.252.87.155', '2026-05-15 00:23:00.912474+00');
INSERT INTO public.activity_logs VALUES (87, 1, 'login', 'Admin logged in', '180.252.87.155', '2026-05-15 01:14:29.050792+00');
INSERT INTO public.activity_logs VALUES (88, 1, 'login', 'Admin logged in', '45.251.4.113', '2026-05-15 04:08:55.349285+00');
INSERT INTO public.activity_logs VALUES (89, 14, 'login', 'Admin logged in', '182.2.180.184', '2026-05-15 13:00:27.485294+00');
INSERT INTO public.activity_logs VALUES (90, 1, 'login', 'Admin logged in', '182.2.180.184', '2026-05-15 13:00:39.961584+00');
INSERT INTO public.activity_logs VALUES (91, 1, 'login', 'Admin logged in', '182.2.184.176', '2026-05-15 13:15:27.777338+00');
INSERT INTO public.activity_logs VALUES (92, 1, 'login', 'Admin logged in', '202.51.197.77', '2026-05-15 13:18:30.370545+00');
INSERT INTO public.activity_logs VALUES (93, 1, 'login', 'Admin logged in', '202.51.197.77', '2026-05-15 13:18:34.959019+00');
INSERT INTO public.activity_logs VALUES (94, 1, 'login', 'Admin logged in', '110.139.27.175', '2026-05-18 07:10:14.332387+00');
INSERT INTO public.activity_logs VALUES (95, 1, 'login', 'Admin logged in', '110.139.27.147', '2026-05-18 07:32:32.808981+00');
INSERT INTO public.activity_logs VALUES (96, 1, 'login', 'Admin logged in', '110.139.27.147', '2026-05-18 08:18:24.828358+00');
INSERT INTO public.activity_logs VALUES (97, 1, 'login', 'Admin logged in', '110.139.27.147', '2026-05-18 09:11:23.490309+00');
INSERT INTO public.activity_logs VALUES (98, 1, 'login', 'Admin logged in', '110.139.27.147', '2026-05-18 09:59:14.756773+00');
INSERT INTO public.activity_logs VALUES (99, 1, 'login', 'Admin logged in', '110.139.27.63', '2026-05-18 10:02:18.317581+00');
INSERT INTO public.activity_logs VALUES (100, 1, 'login', 'Admin logged in', '103.108.130.40', '2026-05-21 10:30:42.527673+00');
INSERT INTO public.activity_logs VALUES (101, 1, 'update_service', 'Updated service: Fast Wash', '103.108.130.40', '2026-05-21 10:34:07.994388+00');
INSERT INTO public.activity_logs VALUES (102, 1, 'update_service', 'Updated service: Hydrolic Wash', '103.108.130.40', '2026-05-21 10:34:44.061144+00');
INSERT INTO public.activity_logs VALUES (103, 1, 'update_service', 'Updated service: Hydrolic Wash', '103.108.130.40', '2026-05-21 10:35:43.465407+00');
INSERT INTO public.activity_logs VALUES (104, 1, 'update_service', 'Updated service: Wash & Wax', '103.108.130.40', '2026-05-21 10:36:19.455398+00');
INSERT INTO public.activity_logs VALUES (105, 1, 'update_service', 'Updated service: Wash & Wax', '103.108.130.40', '2026-05-21 10:36:56.509063+00');
INSERT INTO public.activity_logs VALUES (106, 1, 'update_service', 'Updated service: Fast Wash', '103.108.130.40', '2026-05-21 10:37:52.517959+00');
INSERT INTO public.activity_logs VALUES (107, 1, 'update_service', 'Updated service: Hydrolic Bike Wash', '103.108.130.40', '2026-05-21 10:38:39.939681+00');
INSERT INTO public.activity_logs VALUES (108, 1, 'update_service', 'Updated service: Wash & Wax', '103.108.130.40', '2026-05-21 10:39:42.974974+00');
INSERT INTO public.activity_logs VALUES (109, 1, 'update_service', 'Updated service: Bike Fast Wash', '103.108.130.40', '2026-05-21 10:40:11.499912+00');
INSERT INTO public.activity_logs VALUES (110, 1, 'update_service', 'Updated service: Bike Wash & Wax', '103.108.130.40', '2026-05-21 10:40:31.553561+00');
INSERT INTO public.activity_logs VALUES (111, 1, 'update_service', 'Updated service: Member Motor 1 Bulan', '103.108.130.40', '2026-05-21 10:41:32.086371+00');
INSERT INTO public.activity_logs VALUES (112, 1, 'update_service', 'Updated service: Member Mobil 1 Bulan', '103.108.130.40', '2026-05-21 10:42:31.154055+00');
INSERT INTO public.activity_logs VALUES (113, 1, 'create_service', 'Created service: Member Mobil 3 Bulan', '103.108.130.40', '2026-05-21 10:43:48.1884+00');
INSERT INTO public.activity_logs VALUES (114, 1, 'update_service', 'Updated service: Member Mobil 3 Bulan', '103.108.130.40', '2026-05-21 10:44:58.902669+00');
INSERT INTO public.activity_logs VALUES (115, 1, 'update_service', 'Updated service: Member Motor 1 Bulan', '103.108.130.40', '2026-05-21 10:45:23.122742+00');
INSERT INTO public.activity_logs VALUES (116, 1, 'create_service', 'Created service: Member Motor 3 Bulan', '103.108.130.40', '2026-05-21 10:46:13.524383+00');
INSERT INTO public.activity_logs VALUES (117, 1, 'update_service', 'Updated service: Member Mobil 3 Bulan', '103.108.130.40', '2026-05-21 10:46:36.255556+00');
INSERT INTO public.activity_logs VALUES (118, 1, 'update_service', 'Updated service: Member Motor 3 Bulan', '103.108.130.40', '2026-05-21 10:46:55.4622+00');
INSERT INTO public.activity_logs VALUES (119, 1, 'login', 'Admin logged in', '::1', '2026-05-23 14:05:18.678948+00');
INSERT INTO public.activity_logs VALUES (120, 1, 'update_transaction', 'Updated transaction TRXbOjqqriV1779546985 to completed', '::1', '2026-05-23 14:36:27.962977+00');
INSERT INTO public.activity_logs VALUES (121, 1, 'update_transaction', 'Updated transaction TRXT0Rumv681779550220 to completed', '::1', '2026-05-23 15:30:22.172841+00');
INSERT INTO public.activity_logs VALUES (122, 1, 'login', 'Admin logged in', '180.252.81.193', '2026-05-25 05:45:00.754122+00');
INSERT INTO public.activity_logs VALUES (123, 1, 'login', 'Admin logged in', '180.252.81.193', '2026-05-25 06:38:44.76002+00');
INSERT INTO public.activity_logs VALUES (124, 1, 'login', 'Admin logged in', '180.252.81.193', '2026-05-25 06:39:43.648554+00');


--
-- TOC entry 3958 (class 0 OID 18851)
-- Dependencies: 376
-- Data for Name: attendances; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3934 (class 0 OID 17518)
-- Dependencies: 352
-- Data for Name: cash_flows; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.cash_flows VALUES (1, 'in', 100000, 'belanja', '', 1, '2025-11-15 16:13:57.27356+00', '2025-11-15 16:13:57.27356+00', NULL, NULL);
INSERT INTO public.cash_flows VALUES (2, 'out', 200000, 'beli sabun', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODUiIGhlaWdodD0iOTkiIHZpZXdCb3g9IjAgMCA4NSA5OSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBvcGFjaXR5PSIwLjMiIGN4PSI0Mi41IiBjeT0iNTYuNSIgcj0iNDIuNSIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTQxLjM1MTQgODAuNzc4NkgxOFY4NS44Njg1SDQxLjM1MTRWODAuNzc4NloiIGZpbGw9IiMwQzVGNUMiLz4KPHBhdGggZD0iTTY3LjEyNTggNzkuNjc4Nkg0My43NzQ0Vjg2LjIxMDFINjcuMTI1OFY3OS42Nzg2WiIgZmlsbD0iIzBDNUY1QyIvPgo8cGF0aCBkPSJNNTMuOTU0OSA3Ni42MDAzSDMwLjYwMzVWODUuOTMyN0g1My45NTQ5Vjc2LjYwMDNaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNTMuOTU3MSA4Ni4xNDg4SDMwLjYwMzVDMzAuNTQ2IDg2LjE0ODggMzAuNDkwOSA4Ni4xMjU5IDMwLjQ1MDIgODYuMDg1M0MzMC40MDk2IDg2LjA0NDYgMzAuMzg2NyA4NS45ODk1IDMwLjM4NjcgODUuOTMyVjc2LjU5NTNDMzAuMzg2NyA3Ni41Mzc4IDMwLjQwOTYgNzYuNDgyNyAzMC40NTAyIDc2LjQ0MkMzMC40OTA5IDc2LjQwMTQgMzAuNTQ2IDc2LjM3ODUgMzAuNjAzNSA3Ni4zNzg1SDUzLjk1NzFDNTQuMDE0NSA3Ni4zNzg1IDU0LjA2OTcgNzYuNDAxNCA1NC4xMTAzIDc2LjQ0MkM1NC4xNTEgNzYuNDgyNyA1NC4xNzM4IDc2LjUzNzggNTQuMTczOCA3Ni41OTUzVjg1LjkyNzZDNTQuMTc0NCA4NS45NTY1IDU0LjE2OTIgODUuOTg1MSA1NC4xNTg2IDg2LjAxMTlDNTQuMTQ4IDg2LjAzODcgNTQuMTMyMSA4Ni4wNjMxIDU0LjExMTkgODYuMDgzN0M1NC4wOTE3IDg2LjEwNDMgNTQuMDY3NiA4Ni4xMjA3IDU0LjA0MSA4Ni4xMzE4QzU0LjAxNDQgODYuMTQzIDUzLjk4NTkgODYuMTQ4OCA1My45NTcxIDg2LjE0ODhaTTMwLjgyMDMgODUuNzE1Mkg1My43NDAzVjc2LjgxMjFIMzAuODIwM1Y4NS43MTUyWiIgZmlsbD0iIzBDNUY1QyIvPgo8cGF0aCBkPSJNNDAuMjE1NiA3OS43MzA5QzQwLjY1NTUgNzkuMzI2OCA0MS4wNzE3IDc4Ljg5NzYgNDEuNDYyMSA3OC40NDU0QzQxLjczNTIgNzguMDYzOSA0Mi42NjMgNzguMjExMyA0Mi45Nzk1IDc4LjMxNzVDNDMuMjk2IDc4LjQyMzcgNDIuNzQ3NiA4NC43NTE1IDQyLjYyMTggODQuODk4OUM0Mi40OTYxIDg1LjA0NjMgNDAuOTEzNiA4NS4xNTI1IDQwLjg0ODYgODQuODk4OUM0MC43ODM2IDg0LjY0NTMgNDEuNTI0OSA4MC4yMzgyIDQxLjQ2MjEgODAuMTUzNkM0MS4zOTkyIDgwLjA2OTEgNDAuMDUwOSA4MC4wOTk0IDQwLjIxNTYgNzkuNzMwOVoiIGZpbGw9IiMwQzVGNUMiLz4KPHBhdGggZD0iTTQyLjA1OTEgMjUuODY3N1YyNC4xOTQxQzQzLjQ5MTQgMjQuMzgwOSA0NC40MjAzIDI0LjI3MTkgNDQuNzA1NyAyNC4xOTQxVjI1Ljg2NzdMNDMuMzgyNCAyNy41NDEzTDQyLjA1OTEgMjUuODY3N1oiIGZpbGw9IiNGN0I4QTIiIHN0cm9rZT0iIzRCMzgzQyIgc3Ryb2tlLXdpZHRoPSIwLjMxMTM3MiIvPgo8cGF0aCBkPSJNMzQuOTc1NiA3MC43ODM4VjY4LjIxNVY2Ny44MjU4SDM4LjcxMlY3MC43ODM4SDM0Ljk3NTZaIiBmaWxsPSIjRjdEQ0M3IiBzdHJva2U9IiM0QjM4M0MiIHN0cm9rZS13aWR0aD0iMC4zMTEzNzIiLz4KPHBhdGggZD0iTTUwLjY5OTcgNzAuNzgzOFY2OC4yMTVWNjcuODI1OEg0Ni44MDc2VjcwLjc4MzhINTAuNjk5N1oiIGZpbGw9IiNGN0RDQzciIHN0cm9rZT0iIzRCMzgzQyIgc3Ryb2tlLXdpZHRoPSIwLjMxMTM3MiIvPgo8cGF0aCBkPSJNMzkuMjE3OCA3MC44OTk2QzM2LjY2NDUgNjkuMzczOCAzMy45NDk3IDcwLjg3NzkgMzMuMzk5NyA3My4wNzg3QzMzLjEyNDcgNzQuMTc5MiAzMy4xNjg3IDc1Ljk1MDYgMzMuNjc0NyA3Ni4zNzg3QzM2LjQyNDcgNzYuOTI4NyA0MC44MjQ3IDc2LjY1MzcgNDEuMDQ3MSA3Ni40MjY1QzQxLjI2OTUgNzYuMTk5MiA0MS4wNDcxIDc0Ljc5MTggNDEuMDQ3MSA3NC43OTE4QzQxLjE3MTYgNzMuNjcwOCAzOS44Nzk1IDcxLjcyOTkgMzkuMjE3OCA3MC44OTk2WiIgZmlsbD0iIzNEMjQyMSIgc3Ryb2tlPSIjMEIwMjAzIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIi8+CjxwYXRoIGQ9Ik0zNC4wNjM1IDc1LjIyNThDMzUuMTE2OSA3NS45MTkyIDM3Ljg4MzMgNzYuOTQ2OSA0MC41MjEzIDc1LjUxMTEiIHN0cm9rZT0iIzBCMDIwMyIgc3Ryb2tlLXdpZHRoPSIwLjMxMTM3MiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxwYXRoIGQ9Ik0zNC45MzYgNzQuNzkxNkMzNi4wNzc3IDc0LjIwNzggMzguNjk1OCA3My4zOTA0IDQwLjAzNDcgNzQuNzkxNiIgc3Ryb2tlPSIjMEIwMjAzIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTM2LjMzNzQgNzMuNDY4QzM2LjgzMDQgNzMuMjg2NCAzOC4wNDk5IDczLjAzMjEgMzguOTg0MSA3My40NjgiIHN0cm9rZT0iIzBCMDIwMyIgc3Ryb2tlLXdpZHRoPSIwLjMxMTM3MiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxwYXRoIGQ9Ik0zNi42ODggNzIuNzY4MUMzNi45NjA0IDcyLjYyNTQgMzcuNzE1NSA3Mi40MjU2IDM4LjU1NjIgNzIuNzY4MSIgc3Ryb2tlPSIjMEIwMjAzIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTM5LjM5MzcgNzEuNTc2N0MzNy4yNTAyIDcwLjU4NzggMzUuNzQ4IDcxLjM0NDkgMzUuMjY0OSA3MS44NDdDMzQuMjQ1OCA3My40MjMgMzYuMTU4IDcyLjMyMzQgMzcuMjQxNCA3MS41NzY3QzM4Ljg2NjYgNzMuMDgzMSA0Mi4wNzMgNzIuODEyNyAzOS4zOTM3IDcxLjU3NjdaIiBmaWxsPSIjM0QyNDIxIiBzdHJva2U9IiMwQjAyMDMiIHN0cm9rZS13aWR0aD0iMC4zMTEzNzIiLz4KPHBhdGggZD0iTTQ2LjM3OTQgNzAuOTg4MkM0OC45MzI3IDY5LjQ2MjUgNTAuNTU3IDcwLjYxMiA1MS4wNSA3MS4zNzc0QzUxLjc2NjIgNzIuNjg1MSA1Mi4yNTY2IDc1Ljg4OTUgNTEuODI4NCA3Ni4yMDM3QzQ5LjYyNDggNzcuMjA0MSA0NS43NzQ4IDc2LjUxNTEgNDQuNTUwMSA3Ni41MTUxVjc0Ljg4MDRDNDQuNDI1NiA3My43NTk1IDQ1LjcxNzggNzEuODE4NSA0Ni4zNzk0IDcwLjk4ODJaIiBmaWxsPSIjM0QyNDIxIiBzdHJva2U9IiMwQjAyMDMiIHN0cm9rZS13aWR0aD0iMC4zMTEzNzIiLz4KPHBhdGggZD0iTTUxLjQ1OTUgNzUuMzgxOEM1MC40MDYxIDc2LjA3NTIgNDcuNjM5NyA3Ny4xMDI5IDQ1LjAwMTYgNzUuNjY3MSIgc3Ryb2tlPSIjMEIwMjAzIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTUwLjY2MDYgNzQuODgwMkM0OS41MTg5IDc0LjI5NjQgNDYuOTAwOCA3My40NzkxIDQ1LjU2MTkgNzQuODgwMiIgc3Ryb2tlPSIjMEIwMjAzIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTQ5LjI1OTggNzMuNTU2NkM0OC43NjY4IDczLjM3NSA0Ny41NDcyIDczLjEyMDcgNDYuNjEzMSA3My41NTY2IiBzdHJva2U9IiMwQjAyMDMiIHN0cm9rZS13aWR0aD0iMC4zMTEzNzIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8cGF0aCBkPSJNNDguOTA5MiA3Mi44NTU3QzQ4LjYzNjcgNzIuNzEzIDQ3Ljg4MTcgNzIuNTEzMiA0Ny4wNDA5IDcyLjg1NTciIHN0cm9rZT0iIzBCMDIwMyIgc3Ryb2tlLXdpZHRoPSIwLjMxMTM3MiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxwYXRoIGQ9Ik00Ni4yMDM1IDcxLjY2NTNDNDguMzQ3IDcwLjY3NjQgNDkuODQ5MiA3MS40MzM1IDUwLjMzMjMgNzEuOTM1N0M1MS4zNTEzIDczLjUxMTYgNDkuNDM5MiA3Mi40MTIxIDQ4LjM1NTcgNzEuNjY1M0M0Ni43MzA2IDczLjE3MTcgNDMuNTI0MSA3Mi45MDEzIDQ2LjIwMzUgNzEuNjY1M1oiIGZpbGw9IiMzRDI0MjEiIHN0cm9rZT0iIzBCMDIwMyIgc3Ryb2tlLXdpZHRoPSIwLjMxMTM3MiIvPgo8cGF0aCBkPSJNMzMuMjg5MyA2OC44ODc0QzMyLjc0MzMgNjguMjA3NCAzNS4wNjIyIDUzLjQ2MjkgMzUuMDYyMiA1My40NjI5TDM2LjA4ODYgNDIuNTM3Nkg0OS41ODE5TDUwLjgxNzQgNTIuNzE0OEM1MC44MTc0IDUyLjcxNDggNTIuMDQ5NyA2OC4yMDc0IDUxLjg5MzcgNjguODg3NEM1MS43Mzc3IDY5LjU2NzUgNDQuODA5MiA2OS41Njc1IDQ1LjE5OTIgNjguODg3NEM0NS41ODkyIDY4LjIwNzQgNDMuNDIwMiA1MC4yOTAyIDQzLjAzMDIgNTAuMzU4MkM0Mi42NDAzIDUwLjQyNjIgMzkuMzYwMyA2Ny43MzEzIDM5LjcxMTMgNjguODg3NEM0MC4wNjIzIDcwLjA0MzUgMzMuODM1MyA2OS41Njc1IDMzLjI4OTMgNjguODg3NFoiIGZpbGw9IiMzMjFDMUYiIHN0cm9rZT0iIzJDMjUyNiIgc3Ryb2tlLXdpZHRoPSIwLjMxMTM3MiIvPgo8cGF0aCBkPSJNNDcuNjI0OSAzNy45MzM1SDM5LjEwMTFWMzkuNDEyNUM0Mi40MDE2IDQwLjE1OTggNDYuMTU4OCAzOS43MjM5IDQ3LjYyNDkgMzkuNDEyNVYzNy45MzM1WiIgZmlsbD0iIzRCMzgzQyIgc3Ryb2tlPSIjMzMyOTJCIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIi8+CjxyZWN0IHg9IjQyLjQ0ODQiIHk9IjM4LjYzNDUiIHdpZHRoPSIxLjcxMjU0IiBoZWlnaHQ9IjAuNzc4NDI5IiByeD0iMC4wNzc4NDI5IiBmaWxsPSIjMzMyOTJCIiBzdHJva2U9IiNBMzhEN0EiIHN0cm9rZS13aWR0aD0iMC4xNTU2ODYiLz4KPHBhdGggZD0iTTM5LjQyNTcgMjguNTE3Mkw0MC40MDk4IDI2Ljk2NzJMNDMuNjQ5MyAyNy4xNjA5TDQ2LjgwNjggMjYuOTY3Mkw0Ny42NjggMjguNTE3Mkw0OC4xMTkxIDM3Ljk3MjhDNDQuNDQ0OSAzOC42MjM4IDQwLjQ2NDUgMzguMjQ0IDM4LjkzMzYgMzcuOTcyOEwzOS40MjU3IDI4LjUxNzJaIiBmaWxsPSJ3aGl0ZSIgc3Ryb2tlPSIjNEIzODNDIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIi8+CjxwYXRoIGQ9Ik00My4zNzA2IDI4Ljc1ODFWMzguMDk5MiIgc3Ryb2tlPSIjQUM5RkExIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTM1LjI4MjEgNDEuMDUzNEMzNS43MTg5IDM5LjcxOCAzNy4wNDExIDMzLjA3ODMgMzcuNjQ3NyAyOS45MjU0TDQzLjM3MDIgMzEuMzY1NUw0Ny40MTggMjkuMzgwNUM0OC4xNzYyIDMyLjc1MjYgNDkuODg1MyA0MC45NjA5IDUwLjEwMzYgNDIuNDU4MUM1MC4zNzY2IDQ0LjMyOTYgNTAuNjEyNSA0NC4yNCA1MC44ODU1IDQ0Ljc5NjRDNTEuMTAzOCA0NS4yNDE2IDUxLjA5NzggNDYuMjYzMyA1MS4wNjc0IDQ2LjcxODVDNDEuNDIzNCA0OC42NDA2IDM1LjczNzEgNDYuODE5NyAzNS4yODIxIDQ2LjcxODVDMzQuOTE4MiA0Ni42Mzc2IDM1LjEzMDUgNDUuNDAzNCAzNS4yODIxIDQ0Ljc5NjRDMzUuMTAwMiA0NC4xMDUyIDM0Ljg0NTQgNDIuMzg4NyAzNS4yODIxIDQxLjA1MzRaIiBmaWxsPSIjRUNGREYzIi8+CjxlbGxpcHNlIGN4PSIzOS4yOTU3IiBjeT0iMTkuMTM0MSIgcng9IjEuMTI4NzIiIHJ5PSIwLjU4MzgyMiIgZmlsbD0iI0Y4NTY0QSIvPgo8ZWxsaXBzZSBjeD0iNDcuNzAyOSIgY3k9IjE5LjEzNDEiIHJ4PSIxLjEyODcyIiByeT0iMC41ODM4MjIiIGZpbGw9IiNGODU2NEEiLz4KPHBhdGggZD0iTTM1LjQ2OTMgNDcuMDEyNUMzNC4xMzA0IDQ2LjU3NjYgMzUuODE5NiAzOC45NDI4IDM2LjAxNDIgMzguNjgzM0w1MC4yNTk0IDM5LjExMTVDNTAuOTc1NiA0MC43OTI5IDUxLjE0MTcgNDUuMjA5MiA1MS4xMTU3IDQ3LjAxMjVDNTAuOTk4OSA0OC4wMjQ1IDM3LjE0MjkgNDcuNTU3NCAzNS40NjkzIDQ3LjAxMjVaIiBmaWxsPSIjRUNGREYzIiBzdHJva2U9IiMwQjAyMDMiIHN0cm9rZS13aWR0aD0iMC4zMTEzNzIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8cGF0aCBkPSJNMzcuNDggMjguOTkyNkMzOC4wNDA0IDI4LjI0NTMgMzkuNjIxIDI3LjYwNDQgNDAuMjE3OCAyNy4zMTlMMzkuOTQ1MyAzNC45MDg3TDQyLjExMTYgMzcuMjgyOUw0NS44MDkyIDM5LjE5QzQ0LjQwOCAzOS43NjA5IDQxLjA5OTcgNDAuOTQxNSAzOS4wNzU4IDQxLjA5NzJDMzYuNTQ1OSA0MS4yOTE4IDM2LjM5MDIgNDAuMDQ2MyAzNS43Njc0IDM5LjE5QzM1LjE0NDcgMzguMzMzNyAzNS41MzM5IDM0LjYzNjIgMzUuNzY3NCAzMy4yMzVDMzYuMDAxIDMxLjgzMzkgMzYuNzc5NCAyOS45MjY3IDM3LjQ4IDI4Ljk5MjZaIiBmaWxsPSIjRUNGREYzIiBzdHJva2U9IiMwQjAyMDMiIHN0cm9rZS13aWR0aD0iMC4zMTEzNzIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8cGF0aCBkPSJNNDYuMTMzMyAyNy4wMDc0QzQ2Ljk3NjYgMjcuMzQ0OCA0OS4wMDc5IDI4LjM2OTcgNDkuODE3NSAyOS42MTUyQzUwLjYyNzEgMzAuODYwNyA1MS40NjU1IDMyLjgwNjcgNTEuOTcxNSAzNC4yNDY4QzUyLjQwOTEgMzUuNDkyMyA1Mi45NDQ1IDM4Ljg3ODUgNTIuMzk5NiAzOS42OTU4QzUxLjQyMjEgNDEuMTYyMSA1MS4wMjQxIDQxLjIxMzggNDguNjQ5OSA0MC41MTMyTDQyLjMwNTcgMzcuNjcxOUM0Mi42NTYgMzYuNjcyOSA0My4zNDg4IDM0LjU4OTMgNDMuMzE3NiAzNC4yNDY4QzQ0LjM4MTMgMzQuNDI1MyA0Ni4xMTg4IDM0Ljc3MjEgNDcuNzU0NyAzNS4yMTZDNDcuNzI4NyAzMi45NzI4IDQ3LjI1NDIgMjguMTU5NSA0Ni4xMzMzIDI3LjAwNzRaIiBmaWxsPSIjRUNGREYzIi8+CjxwYXRoIGQ9Ik00Ny43NTQ3IDM1LjIxNkM0Ni4xMTg4IDM0Ljc3MjEgNDQuMzgxMyAzNC40MjUzIDQzLjMxNzYgMzQuMjQ2OEM0My4zNDg4IDM0LjU4OTMgNDIuNjU2IDM2LjY3MjkgNDIuMzA1NyAzNy42NzE5TDQ4LjY0OTkgNDAuNTEzMkM1MS4wMjQxIDQxLjIxMzggNTEuNDIyMSA0MS4xNjIxIDUyLjM5OTYgMzkuNjk1OEM1Mi45NDQ1IDM4Ljg3ODUgNTIuNDA5MSAzNS40OTIzIDUxLjk3MTUgMzQuMjQ2OEM1MS40NjU1IDMyLjgwNjcgNTAuNjI3MSAzMC44NjA3IDQ5LjgxNzUgMjkuNjE1MkM0OS4wMDc5IDI4LjM2OTcgNDYuOTc2NiAyNy4zNDQ4IDQ2LjEzMzMgMjcuMDA3NEM0Ny4yNTQyIDI4LjE1OTUgNDcuNzI4NyAzMi45NzI4IDQ3Ljc1NDcgMzUuMjE2Wk00Ny43NTQ3IDM1LjIxNkM0OS4yMTE0IDM1LjYxMTMgNTAuNTg3NCAzNi4wODM1IDUxLjMzNTQgMzYuNTgyMUM1MC43Njg2IDM2LjI4MTIgNDkuMjU4OSAzNS41ODY2IDQ3Ljc1NDcgMzUuMjE2WiIgc3Ryb2tlPSIjMEIwMjAzIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTQ3LjY2ODcgMzMuODgzNEM0Ni43NTUgMzQuMTQ5OCA0Ni42NzYgMzQuMTcyOCA0Ni4yODk3IDM0Ljc5MDhDNDguNDI5MyAzNS4yMDEgNTEuMTI5NiAzNi40NjU1IDUwLjkxOTggMzUuMjM3MkM1MC43MSAzNC4wMDg5IDQ5LjA3NDggMzMuNDczNCA0Ny42OTAzIDMzLjg3NzFMNDcuNjY4NyAzMy44ODM0WiIgZmlsbD0iI0Y4QTY4QSIgc3Ryb2tlPSIjMEIwMjAzIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTM4LjY4NjEgMzUuOTIxMUM0MC4wMjUgMzQuMzMzMSA0Mi4zMzE3IDM0LjMyNTMgNDMuMzE3NyAzNC41MTk5TDQyLjQyMjUgMzcuMjQ0NEM0MS4yOTM4IDM3LjE2NjUgMzguMjE5IDM2LjY5OTUgMzguNjg2MSAzNS45MjExWiIgZmlsbD0iI0Y4QTY4QSIgc3Ryb2tlPSIjMEIwMjAzIiBzdHJva2Utd2lkdGg9IjAuMzExMzcyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTQzLjQ0ODIgMzAuNTQ5QzQxLjk1NzIgMzAuMDAzNSA0MC43MTU2IDI4LjY2OTEgNDAuMTM5OSAyNy4zOTY0TDM4LjU4MyAyOC4xMzU5QzM5LjMxMDMgMzAuNDk5NiA0MS43NzQ2IDMxLjI4ODUgNDMuNDQ4MiAzMi40NTYyQzQ1LjUxMSAzMC44NjA0IDQ3LjYxMDEgMjkuNjA5OCA0OC4wNzk4IDI4LjI5MTZMNDYuNjc4NyAyNy40NzQyQzQ1Ljk1MTQgMjkuMjE5NyA0NC40MTc5IDI5Ljc3NjMgNDMuNDQ4MiAzMC41NDlaIiBmaWxsPSIjQTZGNEM1IiBzdHJva2U9IiMwQzVGNUMiIHN0cm9rZS13aWR0aD0iMC4zMTEzNzIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8cGF0aCBkPSJNMzkuNDEyMyAyOC44MjcyTDQwLjA5NTEgMjguMjg3NiIgc3Ryb2tlPSIjMEM1RjVDIiBzdHJva2Utd2lkdGg9IjAuMjMzNTI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTQwLjIyNDggMjkuNzg4TDQwLjkwNzYgMjkuMjQ4NCIgc3Ryb2tlPSIjMEM1RjVDIiBzdHJva2Utd2lkdGg9IjAuMjMzNTI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTQxLjE1NzkgMzAuNTkyN0w0MS44NDA3IDMwLjA1MzEiIHN0cm9rZT0iIzBDNUY1QyIgc3Ryb2tlLXdpZHRoPSIwLjIzMzUyOSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxwYXRoIGQ9Ik00Mi4zNiAzMS4zMjM0TDQzLjA0MjkgMzAuNzgzOCIgc3Ryb2tlPSIjMEM1RjVDIiBzdHJva2Utd2lkdGg9IjAuMjMzNTI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTQ3LjM0MDYgMjguNjgwOUw0Ni43OTcyIDI4LjI4NzgiIHN0cm9rZT0iIzBDNUY1QyIgc3Ryb2tlLXdpZHRoPSIwLjIzMzUyOSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxwYXRoIGQ9Ik00Ni40ODQzIDI5LjYxNTRMNDUuOTg0NCAyOS4yNDkiIHN0cm9rZT0iIzBDNUY1QyIgc3Ryb2tlLXdpZHRoPSIwLjIzMzUyOSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxwYXRoIGQ9Ik00NS42Mjc2IDMwLjMxNTNMNDUuMTI4NiAyOS44OTY0IiBzdHJva2U9IiMwQzVGNUMiIHN0cm9rZS13aWR0aD0iMC4yMzM1MjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8cGF0aCBkPSJNNDQuNTM3OSAzMS4xNzE0TDQ0LjAwNDYgMzAuNzA0MyIgc3Ryb2tlPSIjMEM1RjVDIiBzdHJva2Utd2lkdGg9IjAuMjMzNTI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTQzLjM4MjggMjcuMTkwMkw0Mi4wMjA1IDI1Ljc4OUM0MS42MTU3IDI1LjYzMzMgNDAuNjg0MiAyNi42NTgyIDQwLjI2OSAyNy4xOTAyQzQwLjM2MjUgMjcuODc1MiA0MS4yMTYxIDI4LjY2OTIgNDEuNjMxMyAyOC45ODA1TDQzLjM4MjggMjcuMTkwMloiIGZpbGw9IndoaXRlIiBzdHJva2U9IiNBQzlGQTEiIHN0cm9rZS13aWR0aD0iMC4zMTEzNzIiLz4KPHBhdGggZD0iTTQzLjM4MjkgMjcuMjA2TDQ0Ljc0NTEgMjUuODA0OUM0NS4xNDk5IDI1LjY0OTIgNDYuMDgxNCAyNi42NzQxIDQ2LjQ5NjYgMjcuMjA2QzQ2LjQwMzIgMjcuODkxIDQ1LjU0OTUgMjguNjg1IDQ1LjEzNDMgMjguOTk2NEw0My4zODI5IDI3LjIwNloiIGZpbGw9IndoaXRlIiBzdHJva2U9IiNBQzlGQTEiIHN0cm9rZS13aWR0aD0iMC4zMTEzNzIiLz4KPHBhdGggZD0iTTQ0LjA2NTQgNS4yNDc4TDU0LjcyMzYgMTEuMTEwMUw1NC44Mzg5IDExLjE3MzZMNTQuNzk0OSAxMS4yOTc2TDUxLjg2MzMgMTkuNTU3NEw1MS44NTQ1IDE5LjU4MjhMNTEuODM3OSAxOS42MDMzTDUwLjYyMDEgMjEuMDk4NEw1MC42MTMzIDIxLjEwNjJMNTAuNjA1NSAyMS4xMTRDNDcuMTI3OSAyNC4zMzkgNDQuMTE3MSAyNC45MjI3IDQxLjYxODIgMjQuMzM0N0MzOS4xMzQ2IDIzLjc1MDMgMzcuMTkwNyAyMi4wMTQzIDM1LjgyNzEgMjAuNjgwNEwzNS44MTc0IDIwLjY3MDdMMzUuODA4NiAyMC42NTg5TDM1LjA3MDMgMTkuNTk0NUwzNS4wNDQ5IDE5LjU1ODNMMzUuMDQzIDE5LjUxNTRMMzQuOTIwOSAxNy41Nzc5TDM0Ljc5ODggMTUuNjQxNFYxNS42NDA0TDM0LjM1MDYgMTAuNzA2OEwzNC4zNDE4IDEwLjYwNjJMMzQuNDI4NyAxMC41NTc0TDQzLjkxNSA1LjI0NzhMNDMuOTg5MyA1LjIwNTgxTDQ0LjA2NTQgNS4yNDc4WiIgZmlsbD0iI0Y3QjhBMiIgc3Ryb2tlPSIjMkMyNTI2IiBzdHJva2Utd2lkdGg9IjAuMzEiLz4KPHBhdGggZD0iTTM0LjcwNDEgMTUuNTdMMzQuNzE1NCAxNS41NjgxTDM0LjkzMTIgMTkuNTA1N0MzNC41NDUyIDE5LjU3NjkgMzQuMDQ4MSAxOS44MDQ4IDMzLjMwMDQgMTguMjM1QzMyLjIyMTcgMTUuOTg1NyAzMy42Nzc4IDE1Ljc0MTkgMzQuNzA0MSAxNS41N1oiIGZpbGw9IiNGN0I4QTIiIHN0cm9rZT0iIzJDMjUyNiIgc3Ryb2tlLXdpZHRoPSIwLjMxIi8+CjxwYXRoIGQ9Ik01Mi41NzYyIDE1LjU3TDUyLjU2NDkgMTUuNTY4MUw1MS45ODQyIDE5LjUwNTdDNTIuMzcwMiAxOS41NzY5IDUzLjIzMjIgMTkuODA0OCA1My45Nzk4IDE4LjIzNUM1NS4wNTg2IDE1Ljk4NTcgNTMuNjAyNSAxNS43NDE5IDUyLjU3NjIgMTUuNTdaIiBmaWxsPSIjRjdCOEEyIiBzdHJva2U9IiMyQzI1MjYiIHN0cm9rZS13aWR0aD0iMC4zMSIvPgo8bWFzayBpZD0icGF0aC01MS1pbnNpZGUtMV8yMDRfMTk4MzEiIGZpbGw9IndoaXRlIj4KPHBhdGggZD0iTTQzLjE4NDggMC43NjM5NTdDNDYuMTg1NiAtMS4wOTk4NyA0NS4wMjQ2IDAuOTQzOTAxIDQ0LjUyMzQgMS42NTMxQzQ1LjE4OTggMS45MDcxNyA0Ny4zOCAyLjQwMzQgNDguMzU1MyAyLjg5NDQzQzQ4LjQ0NDYgMi45MzkzMiA0OC45MjczIDMuMzEzOTMgNDguOTAwOSAzLjE2MDY5QzQ4LjYyODEgMS4wMzA2IDQ5LjcxOTMgMi4wOTU2NSA0OS45OTIxIDIuMzYxOTFDNTAuNTM3NyAyLjg5NDQzIDUxLjQwOTggMy43ODQ3NyA1MS45NDkyIDQuMzQ0MjRDNTMuMTgxNiA1LjIyMTUzIDUzLjYwMjggNS43MTY5NCA1NC4wODQxIDcuMTU0NjFDNTQuMTU5NiA2LjUwMjIgNTQuNjI5NyA1LjAyNDUyIDU1LjEwNzkgNi4wMTQ0OUM1NS40MzM0IDcuNjQ5MzggNTUuNTU3MSA5LjI5MDE2IDU1LjMzNzkgMTAuOTQ3M0M1NS4zMzAzIDExLjAxNDQgNTUuMzIxOCAxMS4wODE1IDU1LjMxMDYgMTEuMTQ4NkM1NS4zMTY5IDExLjI0OTIgNTUuMzMxNiAxMS4zNTA4IDU1LjMyODUgMTEuNDUxQzU1LjI3NTggMTMuMzM3OSA1NC4zNzE2IDE1LjQxOTEgNTMuNSAxN0M1My4xNjg2IDE3LjYwMTEgNTIuMzY4OCAxOC42MzUgNTIgMTlDNTEuNzI4MSAxOS4yNjg5IDUxLjUzOCAxNy43Mzk0IDUxLjUgMTcuNjAxMUM1MS4zMTY5IDE2LjU2MzggNTEuMTA5MiAxMy4wMDUxIDUwLjY1MTkgMTIuMDQ0OUM0OS41NjA3IDguMjg5NzQgNDMuNzI0MSAxMC40MTQ0IDQzLjcyNDEgMTAuNDE0NEM0Mi41MzI3IDEwLjI3NTIgMzcuNDM4OSA4LjgyMjY1IDM2LjUgMTIuMDQ0OUMzNi4yMDI1IDEzLjA2NiAzNS41NDkgMTYuNTYzOCAzNS4zNjU5IDE3LjYwMTFDMzUuMzI3OSAxNy43Mzk0IDM1LjI3MTkgMTkuMjY4OSAzNSAxOUMzNC42MzEyIDE4LjYzNSAzNCAxNyAzMy41IDE2QzMyLjYyODQgMTQuNDE5MSAzMi4xNzIzIDEyLjgwNSAzMi4xMTk2IDEwLjkxODFDMzIuMTE2NSAxMC44MTc5IDMyLjEzMTIgMTAuNzE2MyAzMi4xMzc1IDEwLjYxNTdDMzIuMTI2MyAxMC41NDg2IDMyLjExNzkgMTAuNDgxNSAzMi4xMTAzIDEwLjQxNDRDMzEuODkxIDguNzU3MjUgMzIuMDE0NyA3LjExNjQ3IDMyLjM0MDIgNS40ODE1OEMzMi44MTg0IDQuNDkxNjEgMzMuMjg4NSA1Ljk2OTI5IDMzLjM2NCA2LjYyMTdDMzMuODQ1NCA1LjE4NDAzIDM0LjI2NjUgNC42ODg2MiAzNS40OTg5IDMuODExMzNDMzYuMDM4MyAzLjI1MTg2IDM2LjkxMDQgMi4zNjE1MiAzNy40NTYgMS44MjlDMzcuNzI4OCAxLjU2Mjc0IDM4LjgyIDAuNDk3NjkyIDM4LjU0NzIgMi42Mjc3OEMzOC41MjA5IDIuNzgxMDIgMzkuMDAzNSAyLjQwNjQgMzkuMDkyOCAyLjM2MTUyQzQwLjgxMTkgMS40OTYwMiA0MS4zMzg0IDEuMTk5MiA0My4xODQ4IDAuNzYzOTU3WiIvPgo8L21hc2s+CjxwYXRoIGQ9Ik00My4xODQ4IDAuNzYzOTU3QzQ2LjE4NTYgLTEuMDk5ODcgNDUuMDI0NiAwLjk0MzkwMSA0NC41MjM0IDEuNjUzMUM0NS4xODk4IDEuOTA3MTcgNDcuMzggMi40MDM0IDQ4LjM1NTMgMi44OTQ0M0M0OC40NDQ2IDIuOTM5MzIgNDguOTI3MyAzLjMxMzkzIDQ4LjkwMDkgMy4xNjA2OUM0OC42MjgxIDEuMDMwNiA0OS43MTkzIDIuMDk1NjUgNDkuOTkyMSAyLjM2MTkxQzUwLjUzNzcgMi44OTQ0MyA1MS40MDk4IDMuNzg0NzcgNTEuOTQ5MiA0LjM0NDI0QzUzLjE4MTYgNS4yMjE1MyA1My42MDI4IDUuNzE2OTQgNTQuMDg0MSA3LjE1NDYxQzU0LjE1OTYgNi41MDIyIDU0LjYyOTcgNS4wMjQ1MiA1NS4xMDc5IDYuMDE0NDlDNTUuNDMzNCA3LjY0OTM4IDU1LjU1NzEgOS4yOTAxNiA1NS4zMzc5IDEwLjk0NzNDNTUuMzMwMyAxMS4wMTQ0IDU1LjMyMTggMTEuMDgxNSA1NS4zMTA2IDExLjE0ODZDNTUuMzE2OSAxMS4yNDkyIDU1LjMzMTYgMTEuMzUwOCA1NS4zMjg1IDExLjQ1MUM1NS4yNzU4IDEzLjMzNzkgNTQuMzcxNiAxNS40MTkxIDUzLjUgMTdDNTMuMTY4NiAxNy42MDExIDUyLjM2ODggMTguNjM1IDUyIDE5QzUxLjcyODEgMTkuMjY4OSA1MS41MzggMTcuNzM5NCA1MS41IDE3LjYwMTFDNTEuMzE2OSAxNi41NjM4IDUxLjEwOTIgMTMuMDA1MSA1MC42NTE5IDEyLjA0NDlDNDkuNTYwNyA4LjI4OTc0IDQzLjcyNDEgMTAuNDE0NCA0My43MjQxIDEwLjQxNDRDNDIuNTMyNyAxMC4yNzUyIDM3LjQzODkgOC44MjI2NSAzNi41IDEyLjA0NDlDMzYuMjAyNSAxMy4wNjYgMzUuNTQ5IDE2LjU2MzggMzUuMzY1OSAxNy42MDExQzM1LjMyNzkgMTcuNzM5NCAzNS4yNzE5IDE5LjI2ODkgMzUgMTlDMzQuNjMxMiAxOC42MzUgMzQgMTcgMzMuNSAxNkMzMi42Mjg0IDE0LjQxOTEgMzIuMTcyMyAxMi44MDUgMzIuMTE5NiAxMC45MTgxQzMyLjExNjUgMTAuODE3OSAzMi4xMzEyIDEwLjcxNjMgMzIuMTM3NSAxMC42MTU3QzMyLjEyNjMgMTAuNTQ4NiAzMi4xMTc5IDEwLjQ4MTUgMzIuMTEwMyAxMC40MTQ0QzMxLjg5MSA4Ljc1NzI1IDMyLjAxNDcgNy4xMTY0NyAzMi4zNDAyIDUuNDgxNThDMzIuODE4NCA0LjQ5MTYxIDMzLjI4ODUgNS45NjkyOSAzMy4zNjQgNi42MjE3QzMzLjg0NTQgNS4xODQwMyAzNC4yNjY1IDQuNjg4NjIgMzUuNDk4OSAzLjgxMTMzQzM2LjAzODMgMy4yNTE4NiAzNi45MTA0IDIuMzYxNTIgMzcuNDU2IDEuODI5QzM3LjcyODggMS41NjI3NCAzOC44MiAwLjQ5NzY5MiAzOC41NDcyIDIuNjI3NzhDMzguNTIwOSAyLjc4MTAyIDM5LjAwMzUgMi40MDY0IDM5LjA5MjggMi4zNjE1MkM0MC44MTE5IDEuNDk2MDIgNDEuMzM4NCAxLjE5OTIgNDMuMTg0OCAwLjc2Mzk1N1oiIGZpbGw9IiM0ODNBMzUiLz4KPHBhdGggZD0iTTQ0LjUyMzQgMS42NTMxTDQ0LjI3MDMgMS40NzQxOUw0NC4wMzk3IDEuODAwNDRMNDQuNDEzIDEuOTQyNzZMNDQuNTIzNCAxLjY1MzFaTTQzLjE4NDggMC43NjM5NTdMNDMuMjU1OSAxLjA2NTY5TDQzLjMwNTMgMS4wNTQwNUw0My4zNDg0IDEuMDI3M0w0My4xODQ4IDAuNzYzOTU3Wk0zOS4wOTI4IDIuMzYxNTJMMzkuMjMyIDIuNjM4NUwzOS4yMzIyIDIuNjM4NDFMMzkuMDkyOCAyLjM2MTUyWk0zOC41NDcyIDIuNjI3NzhMMzguODUzIDIuNjgwMzVMMzguODU0NyAyLjY2NzE2TDM4LjU0NzIgMi42Mjc3OFpNMzcuNDU2IDEuODI5TDM3LjY3MjUgMi4wNTA4NEgzNy42NzI1TDM3LjQ1NiAxLjgyOVpNMzUuNDk4OSAzLjgxMTMzTDM1LjY3ODcgNC4wNjM4OEwzNS43MDIxIDQuMDQ3MkwzNS43MjIxIDQuMDI2NUwzNS40OTg5IDMuODExMzNaTTMzLjM2NCA2LjYyMTdMMzMuMDU2MSA2LjY1NzMyQzMzLjA3MjcgNi44MDE2IDMzLjE4NzQgNi45MTQ5NSAzMy4zMzE4IDYuOTMwMDJDMzMuNDc2MyA2Ljk0NTEgMzMuNjExOCA2Ljg1Nzg1IDMzLjY1OCA2LjcyMDEyTDMzLjM2NCA2LjYyMTdaTTMyLjM0MDIgNS40ODE1OEwzMi4wNjExIDUuMzQ2NzVMMzIuMDQzOSA1LjM4MjMxTDMyLjAzNjIgNS40MjEwNUwzMi4zNDAyIDUuNDgxNThaTTMyLjExMDMgMTAuNDE0NEwzMi40MTg0IDEwLjM3OTVMMzIuNDE3NiAxMC4zNzM3TDMyLjExMDMgMTAuNDE0NFpNMzIuMTM3NSAxMC42MTU3TDMyLjQ0NjkgMTAuNjM0OUwzMi40NDkxIDEwLjU5OTZMMzIuNDQzMyAxMC41NjQ4TDMyLjEzNzUgMTAuNjE1N1pNMzIuMTE5NiAxMC45MTgxTDMyLjQyOTUgMTAuOTA5NEwzMi40Mjk1IDEwLjkwODRMMzIuMTE5NiAxMC45MTgxWk0zMy41IDE2TDMzLjc3NzUgMTUuODYxM0wzMy43NzE1IDE1Ljg1MDNMMzMuNSAxNlpNMzUgMTlMMzQuNzgyIDE5LjIyMDRMMzQuNzgyIDE5LjIyMDRMMzUgMTlaTTM1LjM2NTkgMTcuNjAxMUwzNS42NjQ4IDE3LjY4MzJMMzUuNjY4NiAxNy42NjkyTDM1LjY3MTIgMTcuNjU1TDM1LjM2NTkgMTcuNjAxMVpNMzYuNSAxMi4wNDQ5TDM2Ljc5NzYgMTIuMTMxNkwzNi41IDEyLjA0NDlaTTQzLjcyNDEgMTAuNDE0NEw0My42ODgxIDEwLjcyMjNMNDMuNzYxMSAxMC43MzA4TDQzLjgzMDEgMTAuNzA1N0w0My43MjQxIDEwLjQxNDRaTTQ4LjM1NTMgMi44OTQ0M0w0OC4yMTU5IDMuMTcxMzJMNDguMjE2MSAzLjE3MTQyTDQ4LjM1NTMgMi44OTQ0M1pNNDguOTAwOSAzLjE2MDY5TDQ4LjU5MzEgMy4yMDAxMUw0OC41OTU0IDMuMjEzMjFMNDguOTAwOSAzLjE2MDY5Wk01MS45NDkyIDQuMzQ0MjRMNTEuNzI2IDQuNTU5NDFMNTEuNzQ2IDQuNTgwMTFMNTEuNzY5NCA0LjU5Njc5TDUxLjk0OTIgNC4zNDQyNFpNNTQuMDg0MSA3LjE1NDYxTDUzLjc5MDIgNy4yNTMwM0M1My44MzYzIDcuMzkwNzYgNTMuOTcxOCA3LjQ3ODAxIDU0LjExNjMgNy40NjI5M0M1NC4yNjA4IDcuNDQ3ODYgNTQuMzc1NCA3LjMzNDUxIDU0LjM5MjEgNy4xOTAyM0w1NC4wODQxIDcuMTU0NjFaTTU1LjEwNzkgNi4wMTQ0OUw1NS40MTE5IDUuOTUzOTZMNTUuNDA0MiA1LjkxNTIzTDU1LjM4NyA1Ljg3OTY2TDU1LjEwNzkgNi4wMTQ0OVpNNTUuMzM3OSAxMC45NDczTDU1LjAzMDUgMTAuOTA2Nkw1NS4wMjk4IDEwLjkxMjRMNTUuMzM3OSAxMC45NDczWk01NS4zMTA2IDExLjE0ODZMNTUuMDA0OCAxMS4wOTc3TDU0Ljk5OSAxMS4xMzI1TDU1LjAwMTIgMTEuMTY3OEw1NS4zMTA2IDExLjE0ODZaTTU1LjMyODUgMTEuNDUxTDU1LjAxODYgMTEuNDQxM0w1NS4wMTg2IDExLjQ0MjNMNTUuMzI4NSAxMS40NTFaTTUzLjUgMTdMNTMuMjI4NSAxNi44NTAzTDUzLjUgMTdaTTUyIDE5TDUyLjIxOCAxOS4yMjA0TDUyLjIxOCAxOS4yMjA0TDUyIDE5Wk01MS41IDE3LjYwMTFMNTEuMTk0NyAxNy42NTVMNTEuMTk3MiAxNy42NjkyTDUxLjIwMTEgMTcuNjgzMkw1MS41IDE3LjYwMTFaTTUwLjY1MTkgMTIuMDQ0OUw1MC4zNTQyIDEyLjEzMTRMNTAuMzYxMiAxMi4xNTU1TDUwLjM3MiAxMi4xNzgyTDUwLjY1MTkgMTIuMDQ0OVpNNDQuNzc2NiAxLjgzMjAxQzQ0LjkwODIgMS42NDU3OSA0NS4wODM0IDEuMzcxODQgNDUuMjI0NCAxLjA5MjYzQzQ1LjI5NDkgMC45NTMwMjggNDUuMzU5OCAwLjgwNjQxMiA0NS40MDYgMC42NjQ5NzlDNDUuNDUwNyAwLjUyODE5MyA0NS40ODU4IDAuMzczMjk0IDQ1LjQ3NjggMC4yMjQ5MDJDNDUuNDY3MyAwLjA2ODU2NDQgNDUuNDAzNyAtMC4xMTcxODggNDUuMjE3IC0wLjIyNzYwNUM0NS4wNTA1IC0wLjMyNjA3MSA0NC44NTIyIC0wLjMyMjY2IDQ0LjY3MTIgLTAuMjg3NDM5QzQ0LjMwNTUgLTAuMjE2MjcxIDQzLjc3MzYgMC4wMzMzMDgzIDQzLjAyMTIgMC41MDA2MTlMNDMuMzQ4NCAxLjAyNzNDNDQuMDk2NCAwLjU2MjY5MyA0NC41NDQ3IDAuMzY4ODA4IDQ0Ljc4OTYgMC4zMjExNDRDNDQuOTE0IDAuMjk2OTQ5IDQ0LjkyODUgMC4zMjIxMDIgNDQuOTAxNCAwLjMwNjA1OUM0NC44NTQxIDAuMjc4MDY0IDQ0Ljg1NjMgMC4yMzU0MTYgNDQuODU3OSAwLjI2MjM4NUM0NC44NiAwLjI5NzMgNDQuODUxNSAwLjM2NTkxMyA0NC44MTY3IDAuNDcyMzYzQzQ0Ljc4MzQgMC41NzQxNjcgNDQuNzMyOSAwLjY5MDUxNSA0NC42NzEgMC44MTMxMkM0NC41NDcxIDEuMDU4MzQgNDQuMzg5MyAxLjMwNTgxIDQ0LjI3MDMgMS40NzQxOUw0NC43NzY2IDEuODMyMDFaTTQzLjExMzcgMC40NjIyMjdDNDEuMjMwMSAwLjkwNjIzNyA0MC42NzY3IDEuMjE3MDMgMzguOTUzNCAyLjA4NDYzTDM5LjIzMjIgMi42Mzg0MUM0MC45NDcyIDEuNzc1MDEgNDEuNDQ2NyAxLjQ5MjE3IDQzLjI1NTkgMS4wNjU2OUw0My4xMTM3IDAuNDYyMjI3Wk0zOC45NTM2IDIuMDg0NTRDMzguOTA3NyAyLjEwNzYgMzguODM3MiAyLjE1NjQgMzguNzkxOCAyLjE4NzI4QzM4LjczMzMgMi4yMjcxMiAzOC42NzA3IDIuMjY5NyAzOC42MTI3IDIuMzA1ODZDMzguNTgzOSAyLjMyMzgxIDM4LjU1OSAyLjMzODQyIDM4LjUzODcgMi4zNDkyN0MzOC41MTYzIDIuMzYxMiAzOC41MDgyIDIuMzYzOSAzOC41MTEgMi4zNjI5NkMzOC41MTI1IDIuMzYyNDggMzguNTI1NCAyLjM1ODEgMzguNTQ2MyAyLjM1NTgxQzM4LjU2NDEgMi4zNTM4NiAzOC42MTQxIDIuMzUwMjIgMzguNjc0NCAyLjM3NDNDMzguNzQ3NSAyLjQwMzQ5IDM4LjgwOTEgMi40NjMzIDM4LjgzODUgMi41NDIzMkMzOC44NjI5IDIuNjA3ODggMzguODU1OSAyLjY2MTY0IDM4Ljg1MjcgMi42ODAzTDM4LjI0MTcgMi41NzUyNkMzOC4yMzUyIDIuNjEzMDggMzguMjI4OSAyLjY4MTg3IDM4LjI1NzUgMi43NTg3NUMzOC4yOTEyIDIuODQ5MSAzOC4zNjA1IDIuOTE2NTQgMzguNDQ0NCAyLjk1MDA2QzM4LjUxNTUgMi45Nzg0NyAzOC41Nzk2IDIuOTc1ODggMzguNjEzOSAyLjk3MjExQzM4LjY1MTQgMi45NjggMzguNjgzNiAyLjk1ODk0IDM4LjcwNjYgMi45NTEzMUMzOC43ODg2IDIuOTI0MDQgMzguODc3NyAyLjg3MTI1IDM4Ljk0MDYgMi44MzIwM0MzOS4wMTExIDIuNzg4MDkgMzkuMDg0MyAyLjczODE3IDM5LjE0MDUgMi42OTk5NEMzOS4yMDk5IDIuNjUyNzQgMzkuMjMzMyAyLjYzNzg4IDM5LjIzMiAyLjYzODVMMzguOTUzNiAyLjA4NDU0Wk0zOC44NTQ3IDIuNjY3MTZDMzguOTI0IDIuMTI2MTUgMzguOTE2MSAxLjczMjIyIDM4LjgyMjkgMS40NjQ4QzM4Ljc3MzkgMS4zMjQ1MyAzOC42OTM0IDEuMTk1OTMgMzguNTY1NiAxLjExMDc5QzM4LjQzNSAxLjAyMzcyIDM4LjI5MjMgMS4wMDY5NSAzOC4xNjg3IDEuMDIyMDRDMzcuOTQ0IDEuMDQ5NDUgMzcuNzMzNyAxLjE4NzM2IDM3LjU5MiAxLjI5NTQzQzM3LjQzODggMS40MTIyMiAzNy4zMDczIDEuNTQwOTcgMzcuMjM5NSAxLjYwNzE1TDM3LjY3MjUgMi4wNTA4NEMzNy43NDExIDEuOTgzOSAzNy44NDgzIDEuODc5NjcgMzcuOTY3OSAxLjc4ODQ1QzM4LjA5OSAxLjY4ODUgMzguMTk1NiAxLjY0MzM1IDM4LjI0MzcgMS42Mzc0OEMzOC4yNTY1IDEuNjM1OTIgMzguMjQxNyAxLjYzOTk1IDM4LjIyMTkgMS42MjY3NEMzOC4yMDQ5IDEuNjE1NDQgMzguMjE4MiAxLjYxMzczIDM4LjIzNzQgMS42Njg5OUMzOC4yODA2IDEuNzkyNjQgMzguMzA2OCAyLjA2NDM3IDM4LjIzOTcgMi41ODg0TDM4Ljg1NDcgMi42NjcxNlpNMzcuMjM5NSAxLjYwNzE1QzM2LjY5MDUgMi4xNDI5OSAzNS44MTU4IDMuMDM2IDM1LjI3NTggMy41OTYxN0wzNS43MjIxIDQuMDI2NUMzNi4yNjA4IDMuNDY3NzIgMzcuMTMwMyAyLjU4MDA1IDM3LjY3MjUgMi4wNTA4NEwzNy4yMzk1IDEuNjA3MTVaTTM1LjMxOTIgMy41NTg3OEMzNC42OTcyIDQuMDAxNTQgMzQuMjUzIDQuMzY2MTUgMzMuOTA0NiA0LjgxNjc1QzMzLjU1NDUgNS4yNjk1MSAzMy4zMTU1IDUuNzkwMDYgMzMuMDcgNi41MjMyOEwzMy42NTggNi43MjAxMkMzMy44OTM4IDYuMDE1NjggMzQuMTA2MSA1LjU2OTY5IDM0LjM5NTEgNS4xOTZDMzQuNjg1NyA0LjgyMDE1IDM1LjA2ODMgNC40OTg0MSAzNS42Nzg3IDQuMDYzODhMMzUuMzE5MiAzLjU1ODc4Wk0zMy42NzE5IDYuNTg2MDhDMzMuNjMxMyA2LjIzNDM0IDMzLjQ4NjYgNS42NTc0MyAzMy4yNzI0IDUuMjgyMDlDMzMuMjE3NCA1LjE4NTc1IDMzLjE1MDIgNS4wODg4MSAzMy4wNjgxIDUuMDEwNzJDMzIuOTg3MiA0LjkzMzcgMzIuODY5NiA0Ljg1NDMxIDMyLjcxNzQgNC44NDE0NEMzMi41NTU1IDQuODI3NzUgMzIuNDE2NCA0Ljg5NDA0IDMyLjMxMDYgNC45ODk1QzMyLjIxMDMgNS4wODAxMSAzMi4xMjk2IDUuMjA0ODMgMzIuMDYxMSA1LjM0Njc1TDMyLjYxOTQgNS42MTY0MkMzMi42NzA0IDUuNTEwODQgMzIuNzA5IDUuNDY1MTkgMzIuNzI2MiA1LjQ0OTY2QzMyLjczOCA1LjQzODk5IDMyLjcxNDYgNS40NjM0MSAzMi42NjUyIDUuNDU5MjNDMzIuNjI1NSA1LjQ1NTg3IDMyLjYxNzEgNS40MzczOCAzMi42NDA3IDUuNDU5NzlDMzIuNjYzMSA1LjQ4MTExIDMyLjY5NTUgNS41MjIxMyAzMi43MzM5IDUuNTg5NEMzMi44OTMyIDUuODY4NTEgMzMuMDIxMyA2LjM1NjY1IDMzLjA1NjEgNi42NTczMkwzMy42NzE5IDYuNTg2MDhaTTMyLjAzNjIgNS40MjEwNUMzMS43MDU5IDcuMDc5OTcgMzEuNTc4MSA4Ljc1NTk3IDMxLjgwMjkgMTAuNDU1TDMyLjQxNzYgMTAuMzczN0MzMi4yMDM5IDguNzU4NTMgMzIuMzIzNSA3LjE1Mjk3IDMyLjY0NDMgNS41NDIxMkwzMi4wMzYyIDUuNDIxMDVaTTMxLjgwMjIgMTAuNDQ5MkMzMS44MTAxIDEwLjUxODcgMzEuODE5MyAxMC41OTE4IDMxLjgzMTcgMTAuNjY2NUwzMi40NDMzIDEwLjU2NDhDMzIuNDMzNCAxMC41MDUzIDMyLjQyNTYgMTAuNDQ0MiAzMi40MTgzIDEwLjM3OTVMMzEuODAyMiAxMC40NDkyWk0zMS44MjgxIDEwLjU5NjRDMzEuODI0MSAxMC42NjExIDMxLjgwNjEgMTAuODA5OCAzMS44MDk4IDEwLjkyNzdMMzIuNDI5NSAxMC45MDg0QzMyLjQyNjkgMTAuODI1OSAzMi40Mzg0IDEwLjc3MTUgMzIuNDQ2OSAxMC42MzQ5TDMxLjgyODEgMTAuNTk2NFpNMzEuODA5OCAxMC45MjY3QzMxLjg2MzggMTIuODYzOCAzMi4zMzM0IDE0LjUyNjEgMzMuMjI4NSAxNi4xNDk3TDMzLjc3MTUgMTUuODUwM0MzMi45MjMzIDE0LjMxMiAzMi40ODA4IDEyLjc0NjIgMzIuNDI5NSAxMC45MDk0TDMxLjgwOTggMTAuOTI2N1pNMzMuMjIyNyAxNi4xMzg2QzMzLjQ3IDE2LjYzMzEgMzMuNzQ1NyAxNy4yNzY0IDM0LjAxNzUgMTcuODY3NkMzNC4xNTE0IDE4LjE1ODggMzQuMjgzOCAxOC40MzU5IDM0LjQwNzUgMTguNjY1MUMzNC41MjYgMTguODg0NyAzNC42NTM0IDE5LjA5MzEgMzQuNzgyIDE5LjIyMDRMMzUuMjE4IDE4Ljc3OTZDMzUuMTYyMiAxOC43MjQ0IDM1LjA3MjMgMTguNTkxNSAzNC45NTMxIDE4LjM3MDdDMzQuODM5MSAxOC4xNTk0IDM0LjcxMzQgMTcuODk2OSAzNC41ODA4IDE3LjYwODZDMzQuMzE5OSAxNy4wNDEyIDM0LjAzIDE2LjM2NjkgMzMuNzc3MyAxNS44NjE0TDMzLjIyMjcgMTYuMTM4NlpNMzQuNzgyIDE5LjIyMDRDMzQuODIzNCAxOS4yNjEzIDM0Ljg4ODUgMTkuMzExNCAzNC45NzkgMTkuMzMyMkMzNS4wNzkxIDE5LjM1NTIgMzUuMTc0NSAxOS4zMzQzIDM1LjI1MDIgMTkuMjg5NUMzNS4zNzI1IDE5LjIxNzEgMzUuNDI4OSAxOS4wOTE4IDM1LjQ1MzUgMTkuMDMxN0MzNS41MTM1IDE4Ljg4NDkgMzUuNTUxMiAxOC42ODAzIDM1LjU3NzUgMTguNDk3NEMzNS42MDUxIDE4LjMwNiAzNS42MjQ4IDE4LjEwMzMgMzUuNjM5NiAxNy45NDQ3QzM1LjY0NzIgMTcuODYzOCAzNS42NTMzIDE3Ljc5NjUgMzUuNjU4NyAxNy43NDQyQzM1LjY2NTUgMTcuNjc5NSAzNS42Njg0IDE3LjY3MDIgMzUuNjY0OCAxNy42ODMyTDM1LjA2NjkgMTcuNTE5MUMzNS4wNTM5IDE3LjU2NjYgMzUuMDQ2NyAxNy42MzUzIDM1LjA0MjEgMTcuNjc5OEMzNS4wMzYyIDE3LjczNjUgMzUuMDI5NiAxNy44MDkyIDM1LjAyMjMgMTcuODg3QzM1LjAwNzQgMTguMDQ1NyAzNC45ODkgMTguMjM0NSAzNC45NjM4IDE4LjQwOUMzNC45Mzc1IDE4LjU5MjIgMzQuOTA3OCAxOC43MjgyIDM0Ljg3OTYgMTguNzk2OUMzNC44NjAxIDE4Ljg0NDYgMzQuODY3MiAxOC43OTU3IDM0LjkzNDMgMTguNzU2QzM0Ljk4MjMgMTguNzI3NiAzNS4wNDg3IDE4LjcxMjEgMzUuMTE4IDE4LjcyOEMzNS4xNzc4IDE4Ljc0MTggMzUuMjEwNiAxOC43NzIzIDM1LjIxOCAxOC43Nzk2TDM0Ljc4MiAxOS4yMjA0Wk0zNS42NzEyIDE3LjY1NUMzNS44NTU1IDE2LjYxMDQgMzYuNTA1OSAxMy4xMzI2IDM2Ljc5NzYgMTIuMTMxNkwzNi4yMDI0IDExLjk1ODJDMzUuODk5IDEyLjk5OTQgMzUuMjQyNCAxNi41MTcxIDM1LjA2MDYgMTcuNTQ3MkwzNS42NzEyIDE3LjY1NVpNMzYuNzk3NiAxMi4xMzE2QzM3LjAwNjIgMTEuNDE2IDM3LjQzODIgMTAuOTY3OSAzNy45OTYyIDEwLjY4ODNDMzguNTY1NiAxMC40MDMgMzkuMjc0OCAxMC4yODk5IDQwLjAyMTkgMTAuMjc5MUM0MC43NjU4IDEwLjI2ODMgNDEuNTIzNSAxMC4zNTkyIDQyLjE3NTggMTAuNDYzNEM0Mi41MDE2IDEwLjUxNTQgNDIuNzk4NCAxMC41NzAzIDQzLjA1NDMgMTAuNjE3MkM0My4zMDU2IDEwLjY2MzMgNDMuNTI2OSAxMC43MDM0IDQzLjY4ODEgMTAuNzIyM0w0My43NiAxMC4xMDY0QzQzLjYyMzQgMTAuMDkwNSA0My40MjQ5IDEwLjA1NDggNDMuMTY2IDEwLjAwNzRDNDIuOTExNiA5Ljk2MDc2IDQyLjYwNzYgOS45MDQ1MiA0Mi4yNzM3IDkuODUxMTZDNDEuNjA2NSA5Ljc0NDU4IDQwLjgwODcgOS42NDc2MiA0MC4wMTI5IDkuNjU5MTJDMzkuMjIwMiA5LjY3MDU4IDM4LjQwNTUgOS43ODk3NSAzNy43MTg1IDEwLjEzNEMzNy4wMjAxIDEwLjQ4NCAzNi40NjMzIDExLjA2MjcgMzYuMjAyNCAxMS45NTgyTDM2Ljc5NzYgMTIuMTMxNlpNNDguMjE2MSAzLjE3MTQyQzQ4LjIxNDkgMy4xNzA3OSA0OC4yMzgyIDMuMTg1NjUgNDguMzA3NiAzLjIzMjg1QzQ4LjM2MzggMy4yNzEwOCA0OC40MzcgMy4zMjEgNDguNTA3NSAzLjM2NDk0QzQ4LjU3MDQgMy40MDQxNiA0OC42NTk1IDMuNDU2OTUgNDguNzQxNiAzLjQ4NDIyQzQ4Ljc2NDUgMy40OTE4NSA0OC43OTY3IDMuNTAwOTEgNDguODM0MiAzLjUwNTAzQzQ4Ljg2ODYgMy41MDg3OSA0OC45MzI2IDMuNTExMzggNDkuMDAzNyAzLjQ4Mjk3QzQ5LjA4NzYgMy40NDk0NSA0OS4xNTcgMy4zODIwMiA0OS4xOTA2IDMuMjkxNjZDNDkuMjE5MyAzLjIxNDc4IDQ5LjIxMjkgMy4xNDU5OSA0OS4yMDY0IDMuMTA4MTdMNDguNTk1NCAzLjIxMzIxQzQ4LjU5MjIgMy4xOTQ1NSA0OC41ODUyIDMuMTQwNzkgNDguNjA5NiAzLjA3NTIzQzQ4LjYzOTEgMi45OTYyMSA0OC43MDA2IDIuOTM2NCA0OC43NzM3IDIuOTA3MjFDNDguODM0IDIuODgzMTMgNDguODg0IDIuODg2NzcgNDguOTAxOCAyLjg4ODcyQzQ4LjkyMjcgMi44OTEwMSA0OC45MzU3IDIuODk1MzkgNDguOTM3MSAyLjg5NTg3QzQ4LjkzOTkgMi44OTY4MSA0OC45MzE4IDIuODk0MTEgNDguOTA5NSAyLjg4MjE5QzQ4Ljg4OTEgMi44NzEzMyA0OC44NjQzIDIuODU2NzMgNDguODM1NSAyLjgzODc4QzQ4Ljc3NzQgMi44MDI2MSA0OC43MTQ5IDIuNzYwMDMgNDguNjU2MyAyLjcyMDE5QzQ4LjYxMDkgMi42ODkzMiA0OC41NDA0IDIuNjQwNTIgNDguNDk0NSAyLjYxNzQ1TDQ4LjIxNjEgMy4xNzE0MlpNNDkuMjA4NCAzLjEyMTMxQzQ5LjE0MTMgMi41OTcyOCA0OS4xNjc1IDIuMzI1NTUgNDkuMjEwNyAyLjIwMTlDNDkuMjI5OSAyLjE0NjY0IDQ5LjI0MzIgMi4xNDgzNSA0OS4yMjYzIDIuMTU5NjVDNDkuMjA2NCAyLjE3Mjg2IDQ5LjE5MTYgMi4xNjg4MyA0OS4yMDQ0IDIuMTcwMzlDNDkuMjUyNSAyLjE3NjI2IDQ5LjM0OTEgMi4yMjE0MSA0OS40ODAyIDIuMzIxMzZDNDkuNTk5OCAyLjQxMjU4IDQ5LjcwNyAyLjUxNjgxIDQ5Ljc3NTYgMi41ODM3NUw1MC4yMDg2IDIuMTQwMDZDNTAuMTQwOCAyLjA3Mzg4IDUwLjAwOTMgMS45NDUxMyA0OS44NTYxIDEuODI4MzRDNDkuNzE0NCAxLjcyMDI3IDQ5LjUwNDEgMS41ODIzNiA0OS4yNzk1IDEuNTU0OTVDNDkuMTU1OCAxLjUzOTg2IDQ5LjAxMzEgMS41NTY2NCA0OC44ODI1IDEuNjQzN0M0OC43NTQ3IDEuNzI4ODQgNDguNjc0MiAxLjg1NzQ0IDQ4LjYyNTMgMS45OTc3MkM0OC41MzIgMi4yNjUxMyA0OC41MjQxIDIuNjU5MDYgNDguNTkzNCAzLjIwMDA3TDQ5LjIwODQgMy4xMjEzMVpNNDkuNzc1NiAyLjU4Mzc1QzUwLjMxNzggMy4xMTI5NiA1MS4xODczIDQuMDAwNjMgNTEuNzI2IDQuNTU5NDFMNTIuMTcyMyA0LjEyOTA4QzUxLjYzMjMgMy41Njg5MiA1MC43NTc2IDIuNjc1OSA1MC4yMDg2IDIuMTQwMDZMNDkuNzc1NiAyLjU4Mzc1Wk01MS43Njk0IDQuNTk2NzlDNTIuMzc5OCA1LjAzMTMyIDUyLjc2MjQgNS4zNTMwNyA1My4wNTMxIDUuNzI4OTFDNTMuMzQyIDYuMTAyNiA1My41NTQzIDYuNTQ4NTkgNTMuNzkwMiA3LjI1MzAzTDU0LjM3ODEgNy4wNTYxOUM1NC4xMzI2IDYuMzIyOTcgNTMuODkzNiA1LjgwMjQyIDUzLjU0MzUgNS4zNDk2NkM1My4xOTUxIDQuODk5MDYgNTIuNzUwOSA0LjUzNDQ1IDUyLjEyOSA0LjA5MTdMNTEuNzY5NCA0LjU5Njc5Wk01NC4zOTIxIDcuMTkwMjNDNTQuNDI2OCA2Ljg4OTU2IDU0LjU1NSA2LjQwMTQyIDU0LjcxNDIgNi4xMjIzMUM1NC43NTI2IDYuMDU1MDQgNTQuNzg1MSA2LjAxNDAzIDU0LjgwNzUgNS45OTI3QzU0LjgzMSA1Ljk3MDI5IDU0LjgyMjcgNS45ODg3OSA1NC43ODI5IDUuOTkyMTRDNTQuNzMzNSA1Ljk5NjMyIDU0LjcxMDEgNS45NzE5IDU0LjcyMiA1Ljk4MjU3QzU0LjczOTIgNS45OTgxIDU0Ljc3NzggNi4wNDM3NSA1NC44Mjg4IDYuMTQ5MzNMNTUuMzg3IDUuODc5NjZDNTUuMzE4NSA1LjczNzc0IDU1LjIzNzggNS42MTMwMiA1NS4xMzc1IDUuNTIyNDFDNTUuMDMxOCA1LjQyNjk1IDU0Ljg5MjYgNS4zNjA2NiA1NC43MzA3IDUuMzc0MzVDNTQuNTc4NSA1LjM4NzIyIDU0LjQ2MDkgNS40NjY2MSA1NC4zOCA1LjU0MzYzQzU0LjI5OCA1LjYyMTczIDU0LjIzMDcgNS43MTg2NiA1NC4xNzU4IDUuODE1MDFDNTMuOTYxNiA2LjE5MDM0IDUzLjgxNjkgNi43NjcyNSA1My43NzYyIDcuMTE4OTlMNTQuMzkyMSA3LjE5MDIzWk01NC44MDM5IDYuMDc1MDNDNTUuMTI0NiA3LjY4NTg4IDU1LjI0NDIgOS4yOTE0NCA1NS4wMzA1IDEwLjkwNjZMNTUuNjQ1MiAxMC45ODc5QzU1Ljg3IDkuMjg4ODggNTUuNzQyMiA3LjYxMjg4IDU1LjQxMTkgNS45NTM5Nkw1NC44MDM5IDYuMDc1MDNaTTU1LjAyOTggMTAuOTEyNEM1NS4wMjI1IDEwLjk3NzEgNTUuMDE0NyAxMS4wMzgyIDU1LjAwNDggMTEuMDk3N0w1NS42MTY0IDExLjE5OTRDNTUuNjI4OSAxMS4xMjQ3IDU1LjYzOCAxMS4wNTE2IDU1LjY0NTkgMTAuOTgyMUw1NS4wMjk4IDEwLjkxMjRaTTU1LjAwMTIgMTEuMTY3OEM1NS4wMDk3IDExLjMwNDQgNTUuMDIxMiAxMS4zNTg5IDU1LjAxODYgMTEuNDQxM0w1NS42MzgzIDExLjQ2MDZDNTUuNjQyIDExLjM0MjcgNTUuNjI0IDExLjE5NCA1NS42MiAxMS4xMjkzTDU1LjAwMTIgMTEuMTY3OFpNNTUuMDE4NiAxMS40NDIzQzU0Ljk2ODEgMTMuMjUyMSA1NC4wOTQ5IDE1LjI3OSA1My4yMjg1IDE2Ljg1MDNMNTMuNzcxNSAxNy4xNDk3QzU0LjY0ODQgMTUuNTU5MiA1NS41ODM1IDEzLjQyMzggNTUuNjM4NCAxMS40NTk2TDU1LjAxODYgMTEuNDQyM1pNNTMuMjI4NSAxNi44NTAzQzUyLjkxMTcgMTcuNDI1IDUyLjEzMDEgMTguNDM1MiA1MS43ODIgMTguNzc5Nkw1Mi4yMTggMTkuMjIwNEM1Mi42MDc2IDE4LjgzNDkgNTMuNDI1NSAxNy43NzczIDUzLjc3MTUgMTcuMTQ5N0w1My4yMjg1IDE2Ljg1MDNaTTUxLjc4MiAxOC43Nzk2QzUxLjc5MjkgMTguNzY4OCA1MS44MjY1IDE4LjczOTYgNTEuODg0NSAxOC43MjcxQzUxLjk0ODEgMTguNzEzNCA1Mi4wMDU3IDE4LjcyNzIgNTIuMDQ1NiAxOC43NDhDNTIuMTAzMiAxOC43NzgxIDUyLjExMDEgMTguODE0MyA1Mi4wODY5IDE4Ljc3QzUyLjA1MDIgMTguNzAwMiA1Mi4wMDY4IDE4LjU2NCA1MS45NjQgMTguMzgyMUM1MS45MjMxIDE4LjIwODUgNTEuODg4NSAxOC4wMjAxIDUxLjg2MTQgMTcuODYzMUM1MS44NDcyIDE3Ljc4MTIgNTEuODM3IDE3LjcxOTIgNTEuODI2OCAxNy42NTk1QzUxLjgxODcgMTcuNjEyMyA1MS44MDg3IDE3LjU1NDcgNTEuNzk4OSAxNy41MTkxTDUxLjIwMTEgMTcuNjgzMkM1MS4yMDA4IDE3LjY4MjEgNTEuMjA1MSAxNy43MDI1IDUxLjIxNTcgMTcuNzY0NEM1MS4yMjQyIDE3LjgxMzggNTEuMjM3MiAxNy44OTE4IDUxLjI1MDQgMTcuOTY4NkM1MS4yNzgxIDE4LjEyODggNTEuMzE1MiAxOC4zMzIgNTEuMzYwNSAxOC41MjQzQzUxLjQwMzkgMTguNzA4NSA1MS40NjE1IDE4LjkxMjkgNTEuNTM4MSAxOS4wNTg2QzUxLjU3MTUgMTkuMTIyMSA1MS42MzgyIDE5LjIzNDcgNTEuNzU4NCAxOS4yOTc1QzUxLjgyOTYgMTkuMzM0NyA1MS45MTkyIDE5LjM1MzkgNTIuMDE1NSAxOS4zMzMxQzUyLjEwNjEgMTkuMzEzNSA1Mi4xNzMxIDE5LjI2NDggNTIuMjE4IDE5LjIyMDRMNTEuNzgyIDE4Ljc3OTZaTTUxLjgwNTMgMTcuNTQ3MkM1MS43MTU4IDE3LjA0IDUxLjYyMTEgMTUuOTE4NyA1MS40ODY3IDE0Ljc1ODRDNTEuNDIwNSAxNC4xODY3IDUxLjM0NTEgMTMuNjEyIDUxLjI1NjggMTMuMTE3OEM1MS4xNzAyIDEyLjYzMzMgNTEuMDY2IDEyLjE5MzMgNTAuOTMxOCAxMS45MTE2TDUwLjM3MiAxMi4xNzgyQzUwLjQ2NjUgMTIuMzc2NiA1MC41NTk3IDEyLjc0MTUgNTAuNjQ2NCAxMy4yMjY4QzUwLjczMTQgMTMuNzAyMyA1MC44MDUxIDE0LjI2MjEgNTAuODcwOCAxNC44Mjk4QzUxLjAwMDQgMTUuOTQ4MiA1MS4xMDEyIDE3LjEyNDkgNTEuMTk0NyAxNy42NTVMNTEuODA1MyAxNy41NDcyWk01MC45NDk2IDExLjk1ODRDNTAuNjUwNCAxMC45Mjg4IDUwLjAxNyAxMC4yODk2IDQ5LjI0MDggOS45MjUyOUM0OC40NzczIDkuNTY2OTEgNDcuNTg5NSA5LjQ3OTgzIDQ2Ljc2NjggOS41MTE2N0M0NS45NDA2IDkuNTQzNjUgNDUuMTU0NiA5LjY5NjcxIDQ0LjU3ODIgOS44NDAyNUM0NC4yODkxIDkuOTEyMjIgNDQuMDUwOSA5Ljk4MjMgNDMuODg0MiAxMC4wMzQ2QzQzLjgwMDggMTAuMDYwOCA0My43MzUyIDEwLjA4MjYgNDMuNjkgMTAuMDk4QzQzLjY2NzQgMTAuMTA1NiA0My42NDk5IDEwLjExMTcgNDMuNjM3OCAxMC4xMTZDNDMuNjMxNyAxMC4xMTgxIDQzLjYyNyAxMC4xMTk4IDQzLjYyMzcgMTAuMTIxQzQzLjYyMjEgMTAuMTIxNiA0My42MjA4IDEwLjEyMjEgNDMuNjE5OCAxMC4xMjI0QzQzLjYxOTMgMTAuMTIyNiA0My42MTg5IDEwLjEyMjcgNDMuNjE4NyAxMC4xMjI4QzQzLjYxODUgMTAuMTIyOSA0My42MTgzIDEwLjEyMjkgNDMuNjE4MyAxMC4xMjNDNDMuNjE4MSAxMC4xMjMgNDMuNjE4IDEwLjEyMzEgNDMuNzI0MSAxMC40MTQ0QzQzLjgzMDEgMTAuNzA1NyA0My44MyAxMC43MDU3IDQzLjgzIDEwLjcwNTdDNDMuODMgMTAuNzA1NyA0My44MyAxMC43MDU3IDQzLjgzIDEwLjcwNTdDNDMuODMwMSAxMC43MDU3IDQzLjgzMDIgMTAuNzA1NiA0My44MzA0IDEwLjcwNTVDNDMuODMwOSAxMC43MDU0IDQzLjgzMTcgMTAuNzA1MSA0My44MzI5IDEwLjcwNDdDNDMuODM1MiAxMC43MDM4IDQzLjgzODkgMTAuNzAyNSA0My44NDM5IDEwLjcwMDdDNDMuODU0IDEwLjY5NzIgNDMuODY5NCAxMC42OTE4IDQzLjg4OTggMTAuNjg0OUM0My45MzA2IDEwLjY3MSA0My45OTE1IDEwLjY1MDggNDQuMDY5OCAxMC42MjYyQzQ0LjIyNjYgMTAuNTc3IDQ0LjQ1MjggMTAuNTEwNCA0NC43MjggMTAuNDQxOUM0NS4yODAxIDEwLjMwNDQgNDYuMDIxNCAxMC4xNjEgNDYuNzkwOCAxMC4xMzEyQzQ3LjU2MzYgMTAuMTAxMyA0OC4zMzk2IDEwLjE4NzEgNDguOTc3NCAxMC40ODY1QzQ5LjYwMjQgMTAuNzggNTAuMTA3OCAxMS4yODM0IDUwLjM1NDIgMTIuMTMxNEw1MC45NDk2IDExLjk1ODRaTTQ0LjQxMyAxLjk0Mjc2QzQ0Ljc2MjMgMi4wNzU5MyA0NS41MDMyIDIuMjcwODUgNDYuMjM3NiAyLjQ4Mjc1QzQ2Ljk5NTQgMi43MDE0MSA0Ny43NTg0IDIuOTQwOTkgNDguMjE1OSAzLjE3MTMyTDQ4LjQ5NDcgMi42MTc1NEM0Ny45NzY5IDIuMzU2ODQgNDcuMTU3MiAyLjEwMjc5IDQ2LjQwOTUgMS44ODcwNkM0NS42Mzg0IDEuNjY0NTcgNDQuOTUxIDEuNDg0MzQgNDQuNjMzOSAxLjM2MzQ0TDQ0LjQxMyAxLjk0Mjc2WiIgZmlsbD0iIzJDMjUyNiIgbWFzaz0idXJsKCNwYXRoLTUxLWluc2lkZS0xXzIwNF8xOTgzMSkiLz4KPHBhdGggZD0iTTQzLjc2NDMgMTguNzgwMUM0NC4wNjIgMTguNTU2OSA0NC4wOSAxOC4wMzU4IDQ0LjA5IDE3LjcxMDJDNDQuMDkgMTcuMzg0NyA0NC41NTUxIDE3LjQzMTEgNDQuNjAxNyAxNy43MTAzQzQ0LjY0ODIgMTcuOTg5NSA0NC40NjIxIDE4LjY1OTIgNDQuMjc2IDE4LjkxOTdDNDQuMDQzNCAxOS4yNDUzIDQzLjM5MjIgMTkuMDU5MiA0My43NjQzIDE4Ljc4MDFaIiBmaWxsPSIjMTUwMDAyIi8+CjxyZWN0IHg9IjM5LjA0NzEiIHk9IjE1LjQ2MjMiIHdpZHRoPSIxLjcwNTU0IiBoZWlnaHQ9IjIuODE3NjUiIHJ4PSIwLjg1Mjc2OCIgZmlsbD0iIzE1MDAwMiIgc3Ryb2tlPSIjRjdCOEEyIiBzdHJva2Utd2lkdGg9IjAuMzEiLz4KPHJlY3QgeD0iNDYuNjgxNCIgeT0iMTUuNDYyMyIgd2lkdGg9IjEuNzA1NTQiIGhlaWdodD0iMi44MTc2NSIgcng9IjAuODUyNzY4IiBmaWxsPSIjMTUwMDAyIiBzdHJva2U9IiNGN0I4QTIiIHN0cm9rZS13aWR0aD0iMC4zMSIvPgo8cGF0aCBkPSJNNDEuODkxMSAyMC42NzMyQzQyLjQ2NTggMjEuMjA1NCA0My45NzU2IDIxLjk1MDUgNDUuNDE3NSAyMC42NzMyIiBzdHJva2U9IiM5NTFDMDkiIHN0cm9rZS13aWR0aD0iMC4zMSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxlbGxpcHNlIGN4PSI0MS44NjgzIiBjeT0iMjAuNjYwOCIgcng9IjAuMjc5MTA3IiByeT0iMC4xMzk1NTQiIHRyYW5zZm9ybT0icm90YXRlKC00OC4xNDE2IDQxLjg2ODMgMjAuNjYwOCkiIGZpbGw9IiM5NTFDMDkiLz4KPGVsbGlwc2UgY3g9IjAuMjc5MTA3IiBjeT0iMC4xMzk1NTQiIHJ4PSIwLjI3OTEwNyIgcnk9IjAuMTM5NTU0IiB0cmFuc2Zvcm09Im1hdHJpeCgtMC42NjcyOTIgLTAuNzQ0Nzk2IC0wLjc0NDc5NiAwLjY2NzI5MiA0NS43NjI3IDIwLjY5NykiIGZpbGw9IiM5NTFDMDkiLz4KPHBhdGggZD0iTTQwLjQ1OTcgMTIuNzcwN0MzOS42ODg4IDEyLjI4ODYgMzguODcyOSAxMi44Mjg1IDM4LjU2MTMgMTMuMTU4N0MzOC4xMTczIDEzLjg4OTEgMzkuNDM2MiAxMy44MTA4IDQwLjE1MTIgMTMuNjgwM0M0MC41NzUyIDEzLjU3OCA0MS4yMzA2IDEzLjI1MjggNDAuNDU5NyAxMi43NzA3WiIgZmlsbD0iIzE1MDAwMiIvPgo8cGF0aCBkPSJNNDguNzMzMiAxMi45NTQyQzQ4LjA3MSAxMi4zODM5IDQ3LjE4MjQgMTIuNjI1NSA0Ni44MjA5IDEyLjgxNzZDNDYuMDIyIDEzLjU0NSA0Ny40NzAzIDEzLjcyMDEgNDguMjk0MyAxMy43MTY3QzQ4LjcxNjYgMTMuNzAwMSA0OS4zOTU0IDEzLjUyNDUgNDguNzMzMiAxMi45NTQyWiIgZmlsbD0iIzE1MDAwMiIvPgo8L3N2Zz4K', 1, '2025-11-27 04:41:09.764532+00', '2025-11-27 04:41:09.764532+00', NULL, NULL);
INSERT INTO public.cash_flows VALUES (3, 'in', 25000, 'POS Sales #TRXZPTTuZfW1775660123', '', 14, '2026-04-08 14:55:25.584291+00', '2026-04-08 14:55:25.584291+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (4, 'out', 100000, 'Cashbon User ID: 1 - uang rokok', '', 1, '2026-04-08 14:59:32.976521+00', '2026-04-08 14:59:32.976521+00', NULL, 'loan');
INSERT INTO public.cash_flows VALUES (5, 'out', 30000, 'Cashbon User ID: 1 - bensin', '', 1, '2026-04-08 15:15:24.130663+00', '2026-04-08 15:15:24.130663+00', NULL, 'loan');
INSERT INTO public.cash_flows VALUES (6, 'in', 100000, 'POS Sales #TRXiKsf-GN_1775723990', '', 14, '2026-04-09 08:39:52.504807+00', '2026-04-09 08:39:52.504807+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (7, 'in', 400000, 'POS Sales #TRXGkRzriID1778753419', '', 1, '2026-05-14 10:10:22.897384+00', '2026-05-14 10:10:22.897384+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (8, 'in', 75000, 'POS Sales #TRXxeLRPyiQ1778804601', '', 1, '2026-05-15 00:23:23.381393+00', '2026-05-15 00:23:23.381393+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (9, 'in', 150000, 'POS Sales #TRXFw1-XZ9P1778805700', '', 1, '2026-05-15 00:41:42.639997+00', '2026-05-15 00:41:42.639997+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (10, 'in', 150000, 'POS Sales #TRXParpOnpT1778806243', '', 1, '2026-05-15 00:50:45.758266+00', '2026-05-15 00:50:45.758266+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (11, 'in', 75000, 'POS Sales #TRXlJEzbL0o1778806334', '', 1, '2026-05-15 00:52:16.290939+00', '2026-05-15 00:52:16.290939+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (12, 'in', 75000, 'POS Sales #TRXHo4KP8kD1778807688', '', 1, '2026-05-15 01:14:50.885906+00', '2026-05-15 01:14:50.885906+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (13, 'in', 150000, 'POS Sales #TRXY_jWVjaf1778807936', '', 1, '2026-05-15 01:18:58.492579+00', '2026-05-15 01:18:58.492579+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (14, 'in', 100000, 'POS Sales #TRX58LojqbL1778808201', '', 1, '2026-05-15 01:23:23.747463+00', '2026-05-15 01:23:23.747463+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (15, 'in', 75000, 'POS Sales #TRXoQnk9Z-W1778808526', '', 1, '2026-05-15 01:28:47.832729+00', '2026-05-15 01:28:47.832729+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (16, 'in', 100000, 'POS Sales #TRXV2PCqb871778808592', '', 1, '2026-05-15 01:29:53.959476+00', '2026-05-15 01:29:53.959476+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (17, 'in', 100000, 'POS Sales #TRXNjG-bgSG1778808738', '', 1, '2026-05-15 01:32:20.433678+00', '2026-05-15 01:32:20.433678+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (18, 'in', 150000, 'POS Sales #TRXN-vVfc9U1778808871', '', 1, '2026-05-15 01:34:33.964577+00', '2026-05-15 01:34:33.964577+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (19, 'in', 100000, 'POS Sales #TRXyJzFi2oe1778818913', '', 1, '2026-05-15 04:21:55.237572+00', '2026-05-15 04:21:55.237572+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (20, 'in', 25000, 'POS Sales #TRXkQeQUBBx1778851194', '', 1, '2026-05-15 13:19:56.569866+00', '2026-05-15 13:19:56.569866+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (21, 'in', 150000, 'POS Sales #TRXvuGxDAOt1779091887', '', 1, '2026-05-18 08:11:29.640088+00', '2026-05-18 08:11:29.640088+00', NULL, 'service');
INSERT INTO public.cash_flows VALUES (22, 'in', 140000, 'POS Sales #TRXDd_tAcet1779549848', '', 1, '2026-05-23 15:30:07.326789+00', '2026-05-23 15:30:07.326789+00', NULL, 'service');


--
-- TOC entry 3956 (class 0 OID 18836)
-- Dependencies: 374
-- Data for Name: employee_configs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3962 (class 0 OID 34996)
-- Dependencies: 384
-- Data for Name: employee_loans; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.employee_loans VALUES (1, 1, 100000, 100000, 'uang rokok', 'active', '2026-04-08 14:59:32.577682+00', '2026-04-08 14:59:32.577682+00');
INSERT INTO public.employee_loans VALUES (2, 1, 30000, 30000, 'bensin', 'active', '2026-04-08 15:15:23.727142+00', '2026-04-08 15:15:23.727142+00');


--
-- TOC entry 3960 (class 0 OID 18866)
-- Dependencies: 378
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.employees VALUES (1, 'udin', '08129918820', 'Washer', '001', 20000, '2026-04-08 14:56:55.99367+00', true, '2026-04-08 14:56:56.192693+00', '2026-04-08 14:56:56.192693+00', NULL);


--
-- TOC entry 3936 (class 0 OID 17524)
-- Dependencies: 354
-- Data for Name: ledgers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ledgers VALUES (1, '2025-11-15 16:15:44.864907+00', 'income', 'service', 75000, 'Transaction TRXfbU4ZhEH1763223344', 'TRXfbU4ZhEH1763223344', 1, '2025-11-15 16:15:44.865127+00', '2025-11-15 16:15:44.865127+00', NULL);
INSERT INTO public.ledgers VALUES (2, '2025-11-22 04:52:29.028749+00', 'income', 'service', 50000, 'Transaction TRXk4LMHM_P1763787148', 'TRXk4LMHM_P1763787148', 1, '2025-11-22 04:52:29.028946+00', '2025-11-22 04:52:29.028946+00', NULL);
INSERT INTO public.ledgers VALUES (3, '2025-11-26 18:58:14.622457+00', 'income', 'service', 100000, 'Transaction TRXqacfNF541764177205 marked as paid', 'TRXqacfNF541764177205', 1, '2025-11-26 18:58:14.718277+00', '2025-11-26 18:58:14.718277+00', NULL);
INSERT INTO public.ledgers VALUES (4, '2025-11-26 19:10:31.323931+00', 'income', 'service', 100000, 'Transaction TRX9MwY0HC81764184229', 'TRX9MwY0HC81764184229', 1, '2025-11-26 19:10:31.418232+00', '2025-11-26 19:10:31.418232+00', NULL);
INSERT INTO public.ledgers VALUES (5, '2025-11-27 02:01:44.186193+00', 'income', 'service', 100000, 'Transaction TRXhUXc86x-1764208891 marked as paid', 'TRXhUXc86x-1764208891', 1, '2025-11-27 02:01:44.280831+00', '2025-11-27 02:01:44.280831+00', NULL);
INSERT INTO public.ledgers VALUES (6, '2025-11-27 04:09:14.518512+00', 'income', 'service', 35000, 'Transaction TRXA7CH-zAM1764216553', 'TRXA7CH-zAM1764216553', 1, '2025-11-27 04:09:14.706267+00', '2025-11-27 04:09:14.706267+00', NULL);
INSERT INTO public.ledgers VALUES (7, '2025-11-27 04:09:53.488895+00', 'income', 'service', 35000, 'Transaction TRXlVh0aZE21764216592', 'TRXlVh0aZE21764216592', 1, '2025-11-27 04:09:53.676707+00', '2025-11-27 04:09:53.676707+00', NULL);
INSERT INTO public.ledgers VALUES (8, '2025-11-27 04:21:41.617725+00', 'income', 'service', 35000, 'Transaction TRXZCqK2qex1764217300', 'TRXZCqK2qex1764217300', 1, '2025-11-27 04:21:41.712207+00', '2025-11-27 04:21:41.712207+00', NULL);
INSERT INTO public.ledgers VALUES (9, '2025-11-27 04:23:01.439797+00', 'income', 'service', 50000, 'Transaction TRX4g9VBzUz1764217380', 'TRX4g9VBzUz1764217380', 1, '2025-11-27 04:23:01.534039+00', '2025-11-27 04:23:01.534039+00', NULL);
INSERT INTO public.ledgers VALUES (10, '2025-11-27 04:39:02.128984+00', 'income', 'service', 50000, 'Transaction TRXvZTwv0ZC1764218341', 'TRXvZTwv0ZC1764218341', 1, '2025-11-27 04:39:02.223221+00', '2025-11-27 04:39:02.223221+00', NULL);
INSERT INTO public.ledgers VALUES (11, '2025-11-27 06:23:50.287439+00', 'income', 'service', 100000, 'Transaction TRXo-8cpDX91764224628', 'TRXo-8cpDX91764224628', 1, '2025-11-27 06:23:50.382028+00', '2025-11-27 06:23:50.382028+00', NULL);
INSERT INTO public.ledgers VALUES (12, '2025-11-29 13:33:27.729703+00', 'income', 'service', 175000, 'Transaction TRXj8Z5bPEQ1764423189 marked as paid', 'TRXj8Z5bPEQ1764423189', 1, '2025-11-29 13:33:27.824103+00', '2025-11-29 13:33:27.824103+00', NULL);
INSERT INTO public.ledgers VALUES (13, '2025-11-29 14:05:07.738044+00', 'income', 'service', 25000, 'Transaction TRXixiBVXw01764425106', 'TRXixiBVXw01764425106', 1, '2025-11-29 14:05:07.832333+00', '2025-11-29 14:05:07.832333+00', NULL);
INSERT INTO public.ledgers VALUES (14, '2025-11-29 14:05:39.695842+00', 'income', 'service', 50000, 'Transaction TRXZKa-3nQt1764425138', 'TRXZKa-3nQt1764425138', 1, '2025-11-29 14:05:39.790093+00', '2025-11-29 14:05:39.790093+00', NULL);
INSERT INTO public.ledgers VALUES (15, '2025-11-29 14:54:04.201053+00', 'income', 'service', 25000, 'Transaction TRXa5odDPx71764428042', 'TRXa5odDPx71764428042', 1, '2025-11-29 14:54:04.295788+00', '2025-11-29 14:54:04.295788+00', NULL);
INSERT INTO public.ledgers VALUES (16, '2025-11-29 14:54:28.59572+00', 'income', 'service', 25000, 'Transaction TRX85L9FVpS1764428067', 'TRX85L9FVpS1764428067', 1, '2025-11-29 14:54:28.690149+00', '2025-11-29 14:54:28.690149+00', NULL);
INSERT INTO public.ledgers VALUES (17, '2025-11-29 17:14:53.60064+00', 'income', 'service', 175000, 'Transaction TRXKMgEs6cM1764428000 marked as paid', 'TRXKMgEs6cM1764428000', 1, '2025-11-29 17:14:53.693183+00', '2025-11-29 17:14:53.693183+00', NULL);
INSERT INTO public.ledgers VALUES (18, '2025-11-29 17:15:09.711204+00', 'income', 'service', 175000, 'Transaction TRXOee43tif1764427981 marked as paid', 'TRXOee43tif1764427981', 1, '2025-11-29 17:15:09.80436+00', '2025-11-29 17:15:09.80436+00', NULL);
INSERT INTO public.ledgers VALUES (19, '2026-04-08 14:55:25.18161+00', 'income', 'service', 25000, 'POS #TRXZPTTuZfW1775660123', '', 14, '2026-04-08 14:55:25.181782+00', '2026-04-08 14:55:25.181782+00', NULL);
INSERT INTO public.ledgers VALUES (20, '2026-04-09 08:39:52.096748+00', 'income', 'service', 100000, 'POS #TRXiKsf-GN_1775723990', '', 14, '2026-04-09 08:39:52.096872+00', '2026-04-09 08:39:52.096872+00', NULL);
INSERT INTO public.ledgers VALUES (21, '2026-05-14 10:10:22.469849+00', 'income', 'service', 400000, 'POS #TRXGkRzriID1778753419', '', 1, '2026-05-14 10:10:22.46998+00', '2026-05-14 10:10:22.46998+00', NULL);
INSERT INTO public.ledgers VALUES (22, '2026-05-15 00:23:22.974762+00', 'income', 'service', 75000, 'POS #TRXxeLRPyiQ1778804601', '', 1, '2026-05-15 00:23:22.974924+00', '2026-05-15 00:23:22.974924+00', NULL);
INSERT INTO public.ledgers VALUES (23, '2026-05-15 00:41:42.20608+00', 'income', 'service', 150000, 'POS #TRXFw1-XZ9P1778805700', '', 1, '2026-05-15 00:41:42.206241+00', '2026-05-15 00:41:42.206241+00', NULL);
INSERT INTO public.ledgers VALUES (24, '2026-05-15 00:50:45.35908+00', 'income', 'service', 150000, 'POS #TRXParpOnpT1778806243', '', 1, '2026-05-15 00:50:45.359243+00', '2026-05-15 00:50:45.359243+00', NULL);
INSERT INTO public.ledgers VALUES (25, '2026-05-15 00:52:15.896248+00', 'income', 'service', 75000, 'POS #TRXlJEzbL0o1778806334', '', 1, '2026-05-15 00:52:15.89638+00', '2026-05-15 00:52:15.89638+00', NULL);
INSERT INTO public.ledgers VALUES (26, '2026-05-15 01:14:50.484914+00', 'income', 'service', 75000, 'POS #TRXHo4KP8kD1778807688', '', 1, '2026-05-15 01:14:50.485087+00', '2026-05-15 01:14:50.485087+00', NULL);
INSERT INTO public.ledgers VALUES (27, '2026-05-15 01:18:58.095148+00', 'income', 'service', 150000, 'POS #TRXY_jWVjaf1778807936', '', 1, '2026-05-15 01:18:58.095181+00', '2026-05-15 01:18:58.095181+00', NULL);
INSERT INTO public.ledgers VALUES (28, '2026-05-15 01:23:23.352638+00', 'income', 'service', 100000, 'POS #TRX58LojqbL1778808201', '', 1, '2026-05-15 01:23:23.352773+00', '2026-05-15 01:23:23.352773+00', NULL);
INSERT INTO public.ledgers VALUES (29, '2026-05-15 01:28:47.398392+00', 'income', 'service', 75000, 'POS #TRXoQnk9Z-W1778808526', '', 1, '2026-05-15 01:28:47.398417+00', '2026-05-15 01:28:47.398417+00', NULL);
INSERT INTO public.ledgers VALUES (30, '2026-05-15 01:29:53.743728+00', 'income', 'service', 100000, 'POS #TRXV2PCqb871778808592', '', 1, '2026-05-15 01:29:53.743771+00', '2026-05-15 01:29:53.743771+00', NULL);
INSERT INTO public.ledgers VALUES (31, '2026-05-15 01:32:20.034078+00', 'income', 'service', 100000, 'POS #TRXNjG-bgSG1778808738', '', 1, '2026-05-15 01:32:20.034282+00', '2026-05-15 01:32:20.034282+00', NULL);
INSERT INTO public.ledgers VALUES (32, '2026-05-15 01:34:33.53896+00', 'income', 'service', 150000, 'POS #TRXN-vVfc9U1778808871', '', 1, '2026-05-15 01:34:33.538989+00', '2026-05-15 01:34:33.538989+00', NULL);
INSERT INTO public.ledgers VALUES (33, '2026-05-15 04:21:54.806615+00', 'income', 'service', 100000, 'POS #TRXyJzFi2oe1778818913', '', 1, '2026-05-15 04:21:54.806794+00', '2026-05-15 04:21:54.806794+00', NULL);
INSERT INTO public.ledgers VALUES (34, '2026-05-15 13:19:56.139799+00', 'income', 'service', 25000, 'POS #TRXkQeQUBBx1778851194', '', 1, '2026-05-15 13:19:56.139971+00', '2026-05-15 13:19:56.139971+00', NULL);
INSERT INTO public.ledgers VALUES (35, '2026-05-18 08:11:29.219212+00', 'income', 'service', 150000, 'POS #TRXvuGxDAOt1779091887', '', 1, '2026-05-18 08:11:29.219416+00', '2026-05-18 08:11:29.219416+00', NULL);
INSERT INTO public.ledgers VALUES (36, '2026-05-23 15:30:06.288363+00', 'income', 'service', 140000, 'POS #TRXDd_tAcet1779549848', '', 1, '2026-05-23 15:30:07.081642+00', '2026-05-23 15:30:07.081642+00', NULL);


--
-- TOC entry 3938 (class 0 OID 17530)
-- Dependencies: 356
-- Data for Name: memberships; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.memberships VALUES (3, 4, 3, 'pending', NULL, NULL, 12, false, '2025-11-27 06:49:55.76663+00', '2025-11-27 06:49:55.76663+00', NULL, NULL);
INSERT INTO public.memberships VALUES (4, 4, 3, 'pending', NULL, NULL, 13, false, '2025-11-27 06:54:41.537884+00', '2025-11-27 06:54:41.537884+00', NULL, NULL);
INSERT INTO public.memberships VALUES (5, 4, 3, 'pending', NULL, NULL, 14, false, '2025-11-29 13:33:09.518523+00', '2025-11-29 13:33:09.518523+00', NULL, NULL);
INSERT INTO public.memberships VALUES (6, 15, 4, 'active', '2026-05-14 10:10:21.619667+00', '2026-06-14 10:10:21.619667+00', 23, false, '2026-05-14 10:10:21.619686+00', '2026-05-14 10:10:21.619686+00', NULL, NULL);
INSERT INTO public.memberships VALUES (2, 2, 2, 'active', '2026-05-14 17:17:15.879+00', '2026-06-14 17:17:15.879+00', 5, false, '2025-11-27 02:01:32.306344+00', '2025-11-27 02:01:32.306344+00', NULL, NULL);
INSERT INTO public.memberships VALUES (1, 2, 1, 'active', '2026-04-20 17:17:15.87922+00', '2026-05-20 17:17:15.879+00', 3, false, '2025-11-26 17:13:25.612988+00', '2025-11-26 17:13:25.612988+00', NULL, NULL);


--
-- TOC entry 3940 (class 0 OID 17538)
-- Dependencies: 358
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.payment_methods VALUES (1, 'Cash', 'cash', true, '2025-11-15 13:54:23.393928+00', '2025-11-15 13:54:23.393928+00', NULL);
INSERT INTO public.payment_methods VALUES (2, 'Credit Card', 'xendit', true, '2025-11-15 13:54:23.393928+00', '2025-11-15 13:54:23.393928+00', NULL);
INSERT INTO public.payment_methods VALUES (3, 'QRIS', 'xendit', true, '2025-11-15 13:54:23.393928+00', '2025-11-15 13:54:23.393928+00', NULL);
INSERT INTO public.payment_methods VALUES (4, 'Points', 'points', true, '2026-05-18 07:42:46.91204+00', '2026-05-18 07:42:46.91204+00', NULL);


--
-- TOC entry 3964 (class 0 OID 35016)
-- Dependencies: 386
-- Data for Name: payrolls; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3942 (class 0 OID 17545)
-- Dependencies: 360
-- Data for Name: point_configs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.point_configs VALUES (1, 0.01, 50000, 100000, '2025-11-29 11:45:47.514089+00', 100, 175000);


--
-- TOC entry 3954 (class 0 OID 18827)
-- Dependencies: 372
-- Data for Name: role_accesses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_accesses VALUES ('cashier', '["/dashboard","/dashboard/transactions","/dashboard/memberships","/dashboard/cashier"]');
INSERT INTO public.role_accesses VALUES ('admin', '["/dashboard","/dashboard/employees","/dashboard/transactions","/dashboard/services","/dashboard/memberships","/dashboard/cashier","/dashboard/cashflow","/dashboard/ledger","/dashboard/reports","/dashboard/settings"]');


--
-- TOC entry 3966 (class 0 OID 43127)
-- Dependencies: 388
-- Data for Name: service_categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.service_categories VALUES (1, 'carwash', 'Car Wash', 'service', 1, true, '2026-05-25 06:25:21.573867+00', '2026-05-25 06:25:21.573867+00', NULL);
INSERT INTO public.service_categories VALUES (2, 'bikewash', 'Bike Wash', 'service', 2, true, '2026-05-25 06:25:21.573867+00', '2026-05-25 06:25:21.573867+00', NULL);
INSERT INTO public.service_categories VALUES (3, 'membership', 'Membership', 'membership', 3, true, '2026-05-25 06:25:21.573867+00', '2026-05-25 06:25:21.573867+00', NULL);


--
-- TOC entry 3944 (class 0 OID 17551)
-- Dependencies: 362
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.services VALUES (2, 'carwash', 'Fast Wash', 'Quick exterior wash', 40000, 0, true, '2025-11-29 16:03:25.883586+00', '2026-05-21 10:34:07.190282+00', NULL, 1, 0, 0, 0);
INSERT INTO public.services VALUES (3, 'carwash', 'Hydrolic Wash', 'Hydrolic Wash service', 55000, 0, true, '2025-11-29 16:03:25.883586+00', '2026-05-21 10:35:42.861864+00', NULL, 2, 0, 0, 0);
INSERT INTO public.services VALUES (1, 'carwash', 'Wash & Wax', 'Complete Wash with Wax protection', 100000, 0, true, '2025-11-29 16:03:25.883586+00', '2026-05-21 10:36:55.91125+00', NULL, 3, 0, 0, 0);
INSERT INTO public.services VALUES (6, 'bikewash', 'Hydrolic Bike Wash', 'Hydrolic Wash Service', 35000, 0, true, '2025-11-29 16:03:25.883586+00', '2026-05-21 10:38:39.116226+00', NULL, 2, 0, 0, 0);
INSERT INTO public.services VALUES (5, 'bikewash', 'Bike Fast Wash', 'Quick Wash', 25000, 0, true, '2025-11-29 16:03:25.883586+00', '2026-05-21 10:40:10.900148+00', NULL, 1, 0, 0, 0);
INSERT INTO public.services VALUES (4, 'bikewash', 'Bike Wash & Wax', 'Complete Wash with Wax Protection', 50000, 0, true, '2025-11-29 16:03:25.883586+00', '2026-05-21 10:40:30.953778+00', NULL, 3, 0, 0, 0);
INSERT INTO public.services VALUES (7, 'membership', 'Member Mobil 1 Bulan', 'Paket Membership Mobil 30 Hari', 175000, 0, true, '2025-11-29 16:03:25.883586+00', '2026-05-21 10:42:30.545584+00', NULL, 5, 0, 1, 0);
INSERT INTO public.services VALUES (10, 'membership', 'Member Mobil 3 Bulan', 'Paket Member Mobil 90 Hari', 450000, 0, true, '2026-05-21 10:43:47.162512+00', '2026-05-21 10:44:58.302924+00', NULL, 15, 0, 3, 0);
INSERT INTO public.services VALUES (8, 'membership', 'Member Motor 1 Bulan', 'Paket Membership Motor 30 hari', 75000, 0, true, '2025-11-29 16:03:25.883586+00', '2026-05-21 10:45:22.522945+00', NULL, 5, 0, 1, 0);
INSERT INTO public.services VALUES (11, 'membership', 'Member Motor 3 Bulan', 'Paket Member Motor 90 Hari', 150000, 0, true, '2026-05-21 10:46:12.921938+00', '2026-05-21 10:46:54.861338+00', NULL, 15, 0, 3, 0);


--
-- TOC entry 3946 (class 0 OID 17558)
-- Dependencies: 364
-- Data for Name: transaction_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.transaction_items VALUES (1, 21, 5, 1, NULL, 25000, NULL, 25000, 0, 25000, '');
INSERT INTO public.transaction_items VALUES (2, 22, 3, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (3, 23, 7, 1, NULL, 250000, NULL, 250000, 0, 250000, '');
INSERT INTO public.transaction_items VALUES (4, 23, 1, 1, NULL, 150000, NULL, 150000, 0, 150000, '');
INSERT INTO public.transaction_items VALUES (5, 24, 2, 1, NULL, 75000, NULL, 75000, 0, 75000, '');
INSERT INTO public.transaction_items VALUES (6, 25, 1, 1, NULL, 150000, NULL, 150000, 0, 150000, '');
INSERT INTO public.transaction_items VALUES (7, 26, 1, 1, NULL, 150000, NULL, 150000, 0, 150000, '');
INSERT INTO public.transaction_items VALUES (8, 27, 2, 1, NULL, 75000, NULL, 75000, 0, 75000, '');
INSERT INTO public.transaction_items VALUES (9, 28, 2, 1, NULL, 75000, NULL, 75000, 0, 75000, '');
INSERT INTO public.transaction_items VALUES (10, 29, 1, 1, NULL, 150000, NULL, 150000, 0, 150000, '');
INSERT INTO public.transaction_items VALUES (11, 30, 3, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (12, 31, 2, 1, NULL, 75000, NULL, 75000, 0, 75000, '');
INSERT INTO public.transaction_items VALUES (13, 32, 3, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (14, 33, 3, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (15, 34, 1, 1, NULL, 150000, NULL, 150000, 0, 150000, '');
INSERT INTO public.transaction_items VALUES (16, 35, 3, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (17, 36, 5, 1, NULL, 25000, NULL, 25000, 0, 25000, '');
INSERT INTO public.transaction_items VALUES (18, 37, 1, 1, NULL, 150000, NULL, 150000, 0, 150000, '');
INSERT INTO public.transaction_items VALUES (19, 38, 1, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (20, 39, 1, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (25, 40, 1, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (26, 41, 1, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (27, 42, 1, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (28, 43, 1, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (29, 44, 1, 1, NULL, 100000, NULL, 100000, 0, 100000, '');
INSERT INTO public.transaction_items VALUES (30, 44, 2, 1, NULL, 40000, NULL, 40000, 0, 40000, '');
INSERT INTO public.transaction_items VALUES (31, 45, 1, 1, NULL, 100000, NULL, 100000, 0, 100000, '');


--
-- TOC entry 3948 (class 0 OID 17564)
-- Dependencies: 366
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.transactions VALUES (27, 2, 'TRXlJEzbL0o1778806334', 75000, 75, 'paid', 1, 'cash', '', '', '2026-05-15 00:52:14.303156+00', 1, 'Member: K4LA', '2026-05-15 00:52:14.696848', '2026-05-15 00:52:14.696848', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (28, 2, 'TRXHo4KP8kD1778807688', 75000, 75, 'paid', 1, 'cash', '', '', '2026-05-15 01:14:48.89885+00', 1, 'Member: K4LA', '2026-05-15 01:14:49.29357', '2026-05-15 01:14:49.29357', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (29, 2, 'TRXY_jWVjaf1778807936', 150000, 150, 'paid', 1, 'cash', '', '', '2026-05-15 01:18:56.505828+00', 1, 'Member: K4LA', '2026-05-15 01:18:56.902456', '2026-05-15 01:18:56.902456', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (5, 2, 'TRXhUXc86x-1764208891', 100000, 0, 'paid', 1, 'cash', '', '', '2025-11-27 02:01:43.787809+00', 1, '', '2025-11-27 02:01:31.904664', '2025-11-27 02:01:44.67021', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (30, 2, 'TRX58LojqbL1778808201', 100000, 100, 'paid', 1, 'cash', '', '', '2026-05-15 01:23:21.774162+00', 1, 'Member: K4LA', '2026-05-15 01:23:22.168542', '2026-05-15 01:23:22.168542', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (31, NULL, 'TRXoQnk9Z-W1778808526', 75000, 75, 'paid', 1, 'cash', '', '', '2026-05-15 01:28:46.064253+00', 1, 'Guest:  ', '2026-05-15 01:28:46.495852', '2026-05-15 01:28:46.495852', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (32, NULL, 'TRXV2PCqb871778808592', 100000, 100, 'paid', 1, 'cash', '', '', '2026-05-15 01:29:52.881441+00', 1, 'Guest:  ', '2026-05-15 01:29:53.312245', '2026-05-15 01:29:53.312245', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (33, 2, 'TRXNjG-bgSG1778808738', 100000, 100, 'paid', 1, 'cash', '', '', '2026-05-15 01:32:18.417044+00', 1, 'Member: K4LA', '2026-05-15 01:32:18.815625', '2026-05-15 01:32:18.815625', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (3, 2, 'TRXqacfNF541764177205', 100000, 0, 'paid', 1, 'cash', '', '', '2025-11-26 18:58:14.224294+00', 1, '', '2025-11-27 17:13:25.231', '2025-11-26 18:58:15.117699', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (4, 2, 'TRX9MwY0HC81764184229', 100000, 1000, 'paid', 1, 'cash', '', '', '2025-11-26 19:10:29.702357+00', 1, 'Member Vehicle: K4LA (Nissan March)', '2025-11-27 19:10:30.186', '2025-11-26 19:10:30.186366', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (8, NULL, 'TRXZCqK2qex1764217300', 35000, 350, 'paid', 1, 'cash', '', '', '2025-11-27 04:21:40.479003+00', 1, 'Guest Vehicle: B1234ABC ', '2025-11-27 04:21:40.951442', '2025-11-27 04:21:40.951442', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (9, NULL, 'TRX4g9VBzUz1764217380', 50000, 500, 'paid', 1, 'cash', '', '', '2025-11-27 04:23:00.586901+00', 1, 'Guest Vehicle: AB1212OSS (xpander)', '2025-11-27 04:23:00.964854', '2025-11-27 04:23:00.964854', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (10, NULL, 'TRXvZTwv0ZC1764218341', 50000, 500, 'paid', 1, 'cash', '', '', '2025-11-27 04:39:01.215596+00', 1, 'Guest Vehicle: B9928POP ', '2025-11-27 04:39:01.613671', '2025-11-27 04:39:01.613671', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (11, 2, 'TRXo-8cpDX91764224628', 100000, 1000, 'paid', 1, 'cash', '', '', '2025-11-27 06:23:48.530193+00', 1, 'Member Vehicle: AD 4 m (honda civic turbo)', '2025-11-27 06:23:49.177473', '2025-11-27 06:23:49.177473', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (34, 2, 'TRXN-vVfc9U1778808871', 150000, 150, 'paid', 1, 'cash', '', '', '2026-05-15 01:34:31.827249+00', 1, 'Member: K4LA', '2026-05-15 01:34:32.249955', '2026-05-15 01:34:32.249955', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (12, 4, 'TRXsFpNxbkc1764226195', 100000, 0, 'cancelled', 1, 'cash', '', '', NULL, NULL, '', '2025-11-27 06:49:55.466551', '2025-11-27 06:54:15.977887', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (35, 15, 'TRXyJzFi2oe1778818913', 100000, 100, 'paid', 1, 'cash', '', '', '2026-05-15 04:21:53.074915+00', 1, 'Member: B1234HH', '2026-05-15 04:21:53.489554', '2026-05-15 04:21:53.489554', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (13, 4, 'TRX1RFajPrQ1764226481', 100000, 0, 'cancelled', 2, 'xendit', 'inv_TRX1RFajPrQ1764226481', 'https://xendit.co/pay/...TRX1RFajPrQ1764226481', NULL, NULL, '', '2025-11-27 06:54:41.253616', '2025-11-29 13:32:52.170828', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (36, 15, 'TRXkQeQUBBx1778851194', 25000, 25, 'paid', 1, 'cash', '', '', '2026-05-15 13:19:54.443809+00', 1, 'Member: B1234HH', '2026-05-15 13:19:54.863162', '2026-05-15 13:19:54.863162', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (14, 4, 'TRXj8Z5bPEQ1764423189', 175000, 100, 'paid', 1, 'cash', '', '', '2025-11-29 13:33:27.336773+00', 1, 'New Membership Application', '2025-11-29 13:33:09.127035', '2025-11-29 13:33:28.218416', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (15, 2, 'TRXixiBVXw01764425106', 25000, 10, 'paid', 3, 'cash', '', '', '2025-11-29 14:05:06.242314+00', 1, 'Membership: K4LA', '2025-11-29 14:05:06.622112', '2025-11-29 14:05:06.622112', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (16, 2, 'TRXZKa-3nQt1764425138', 50000, 10, 'paid', 3, 'cash', '', '', '2025-11-29 14:05:38.65061+00', 1, 'Membership: K4LA', '2025-11-29 14:05:38.934303', '2025-11-29 14:05:38.934303', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (37, NULL, 'TRXvuGxDAOt1779091887', 150000, 150, 'paid', 1, 'cash', '', '', '2026-05-18 08:11:27.991181+00', 1, 'Guest: B121212 asas', '2026-05-18 08:11:28.387644', '2026-05-18 08:11:28.387644', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (38, 2, 'TRXLyylSuV21779545835', 100000, 3, 'pending', 1, '', '', '', NULL, 1, 'Member: K4LA', '2026-05-23 21:17:15.280092', '2026-05-23 21:17:15.280092', NULL, 0, 1, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (19, 2, 'TRXa5odDPx71764428042', 25000, 10, 'paid', 3, 'cash', '', '', '2025-11-29 14:54:02.954762+00', 1, 'Membership: K4LA', '2025-11-29 14:54:03.333967', '2025-11-29 14:54:03.333967', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (20, 2, 'TRX85L9FVpS1764428067', 25000, 10, 'paid', 3, 'cash', '', '', '2025-11-29 14:54:27.549824+00', 1, 'Membership: K4LA', '2025-11-29 14:54:27.833178', '2025-11-29 14:54:27.833178', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (18, 2, 'TRXKMgEs6cM1764428000', 175000, 100, 'paid', 1, 'cash', '', '', '2025-11-29 17:14:53.190838+00', 1, 'Membership renewal #2', '2025-11-29 14:53:20.675315', '2025-11-29 17:14:54.085092', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (17, 2, 'TRXOee43tif1764427981', 175000, 100, 'paid', 2, 'xendit', 'inv_TRXOee43tif1764427981', 'https://xendit.co/pay/...TRXOee43tif1764427981', '2025-11-29 17:15:09.431595+00', 1, 'Membership renewal #2', '2025-11-29 14:53:01.444793', '2025-11-29 17:15:10.08314', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (21, 2, 'TRXZPTTuZfW1775660123', 25000, 20, 'paid', 1, 'cash', '', '', '2026-04-08 14:55:23.574024+00', 14, 'Member: K4LA', '2026-04-08 14:55:23.973197', '2026-04-08 14:55:23.973197', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (22, NULL, 'TRXiKsf-GN_1775723990', 100000, 100, 'paid', 1, 'cash', '', '', '2026-04-09 08:39:50.885266+00', 14, 'Guest: B 1234 WSD ', '2026-04-09 08:39:51.287032', '2026-04-09 08:39:51.287032', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (23, 15, 'TRXGkRzriID1778753419', 400000, 325, 'paid', 1, 'cash', '', '', '2026-05-14 10:10:19.72097+00', 1, 'Guest: B 1234 HH lcgc', '2026-05-14 10:10:20.347703', '2026-05-14 10:10:20.347703', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (24, 2, 'TRXxeLRPyiQ1778804601', 75000, 75, 'paid', 1, 'cash', '', '', '2026-05-15 00:23:21.377351+00', 1, 'Member: K4LA', '2026-05-15 00:23:21.774306', '2026-05-15 00:23:21.774306', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (25, 2, 'TRXFw1-XZ9P1778805700', 150000, 150, 'paid', 1, 'cash', '', '', '2026-05-15 00:41:40.465441+00', 1, 'Member: K4LA', '2026-05-15 00:41:40.890627', '2026-05-15 00:41:40.890627', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (26, 2, 'TRXParpOnpT1778806243', 150000, 150, 'paid', 1, 'cash', '', '', '2026-05-15 00:50:43.764304+00', 1, 'Member: K4LA', '2026-05-15 00:50:44.162621', '2026-05-15 00:50:44.162621', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (39, NULL, 'TRXeZFWqZh61779546199', 100000, 3, 'pending', 1, '', '', '', NULL, 1, 'Guest: B000OP mazda', '2026-05-23 21:23:19.257639', '2026-05-23 21:23:19.257639', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (45, NULL, 'TRXT0Rumv681779550220', 100000, 3, 'completed', 1, '', '', '', NULL, 1, 'Member: ', '2026-05-23 22:30:20.256539', '2026-05-23 22:30:21.720955', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (44, NULL, 'TRXDd_tAcet1779549848', 140000, 4, 'paid', 1, '', '', '', '2026-05-23 15:30:06.288363+00', 1, 'Guest: ASAS asas', '2026-05-23 22:24:08.795961', '2026-05-23 22:30:06.40001', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (40, 2, 'TRXbOjqqriV1779546985', 100000, 3, 'completed', 1, '', '', '', NULL, 1, 'Member: K4LA', '2026-05-23 21:36:25.695355', '2026-05-23 21:36:27.514581', NULL, 0, 1, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (41, NULL, 'TRXekWTi3NG1779546989', 100000, 3, 'pending', 1, '', '', '', NULL, 1, 'Guest: B000KJ mazda', '2026-05-23 21:36:30.154613', '2026-05-23 21:36:30.154613', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (42, NULL, 'TRXrYH38Zs61779548972', 100000, 3, 'pending', 1, '', '', '', NULL, 1, 'Guest: ASAS asas', '2026-05-23 22:09:33.145344', '2026-05-23 22:09:33.145344', NULL, 0, NULL, 'service', NULL, NULL, NULL);
INSERT INTO public.transactions VALUES (43, NULL, 'TRXgskhoMwf1779549460', 100000, 3, 'pending', 1, '', '', '', NULL, 1, 'Guest: BJBJJBJ jjj', '2026-05-23 22:17:41.019904', '2026-05-23 22:17:41.019904', NULL, 0, NULL, 'service', NULL, NULL, NULL);


--
-- TOC entry 3950 (class 0 OID 17571)
-- Dependencies: 368
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES (1, 'admin123', 'admin@baxter.com', 'Administrator', NULL, NULL, 'admin', 0, '$2a$10$GMmL6ppvmjvSvdLXOEJxe.44hceLO5docuP9mMnmIc1pFBRunqaZ.', true, '2025-11-15 14:25:00.936662+00', '2025-11-15 14:25:00.936662+00', NULL, '', '', NULL, '', NULL);
INSERT INTO public.users VALUES (17, '104666066937796639719', 'dhikadas0406@gmail.com', 'Andhika Dasparandy', '', 'https://lh3.googleusercontent.com/a/ACg8ocJ6RzXSD4QE2IGlBnP-4yridtiKkZH-E95b0YP0vSTTY-8sOg=s96-c', 'customer', 0, '', true, '2026-05-16 15:26:29.473535+00', '2026-05-18 08:20:32.59857+00', NULL, '', '', NULL, '', 'ch2y2nGpSkOu6KVjCQAcGv:APA91bGG8FSiWKHGmd2Yk-1wKQmpwIBlpzlFe-7h5GrwWDhymF-Mr_Yy4u9YmsOJgfJROC_n477HtZyEOZOhe8esIBYpP7Btp3k3-dcy2FPZvsS--__A-6A');
INSERT INTO public.users VALUES (18, '115893036342526734421', 'dhikadass@gmail.com', 'andhika Dasparandy', '', 'https://lh3.googleusercontent.com/a/ACg8ocKLaDhPsBGh69A088QMvRy-6rwS4vD55fP56Cb5MRE1WNjoFQ=s96-c', 'customer', 0, '', true, '2026-05-18 08:28:19.262755+00', '2026-05-18 09:47:42.419683+00', NULL, '', '', NULL, '', 'ch2y2nGpSkOu6KVjCQAcGv:APA91bGG8FSiWKHGmd2Yk-1wKQmpwIBlpzlFe-7h5GrwWDhymF-Mr_Yy4u9YmsOJgfJROC_n477HtZyEOZOhe8esIBYpP7Btp3k3-dcy2FPZvsS--__A-6A');
INSERT INTO public.users VALUES (8, NULL, 'rusdi@baxter.com', 'rusdi', '', '', 'cashier', 0, '$2a$10$6V/swav.nJe1ck0GCNKz3uTOi1qQ.a7h9swmttLyJzou6tDO//qXO', true, '2025-11-29 11:22:44.72464+00', '2025-11-29 11:22:44.72464+00', '2026-04-08 14:16:54.492649+00', '', '', NULL, '', NULL);
INSERT INTO public.users VALUES (14, NULL, 'rusdi@mail.com', 'rusdi', '', '', 'cashier', 0, '$2a$10$tdeGUh9T.QweuoLPc9loheh9zo31V7n6fo7w8jP7oFabY4.74C9na', true, '2026-04-08 14:25:10.74049+00', '2026-04-08 14:25:10.74049+00', NULL, '', '', NULL, '', NULL);
INSERT INTO public.users VALUES (2, '108494248137485350672', 'tugasmeilyanto@gmail.com', 'Tugas Meilyanto', '81918476387', 'https://lh3.googleusercontent.com/a/ACg8ocLX8wBHQ5dYzXr9yuypEfwtpIOC8JiDAK33Rxr3UfKvlPvPEQuW=s96-c', 'customer', 3285, '', true, '2025-11-17 16:26:15.911199+00', '2026-06-04 15:26:11.805387+00', NULL, 'bintaro', 'jakarta', '1998-05-04', 'male', 'cn4NLu24S5mMy9Z14IBdgC:APA91bHdVnV34Lvp-tcA5N_zQErzts9Ht6m_lTxJKe80qzHAC4zA5KpWus5JEL4Bk4CXdHdaiQRGliodwm7Hucq6ehl3rDpR7PnAgoa-v3T6BPTpFn-CN1w');
INSERT INTO public.users VALUES (15, '113344585645368220416', 'andhika.dasparandy@gmail.com', 'Andhika Dasparandy', '', 'https://lh3.googleusercontent.com/a/ACg8ocKiKTZdFwt4cyeP8MMRseZOlgEqQoEh5gJqGa_rzKimwZsN5xXY=s96-c', 'customer', 450, '', true, '2026-04-09 00:11:35.81874+00', '2026-05-26 17:31:08.200272+00', NULL, '', '', NULL, '', 'ch2y2nGpSkOu6KVjCQAcGv:APA91bGG8FSiWKHGmd2Yk-1wKQmpwIBlpzlFe-7h5GrwWDhymF-Mr_Yy4u9YmsOJgfJROC_n477HtZyEOZOhe8esIBYpP7Btp3k3-dcy2FPZvsS--__A-6A');
INSERT INTO public.users VALUES (16, '100670734219083260451', 'tugas.meilyanto@brifins.com', 'Tugas Meilyanto', '', 'https://lh3.googleusercontent.com/a/ACg8ocISt-_fpI4W3e6jFWZh44lbqmLpESnPjgGVJErdwd4KGu9Fmg=s96-c', 'customer', 0, '', true, '2026-04-11 00:52:58.730015+00', '2026-06-04 15:10:09.743639+00', NULL, '', '', NULL, '', 'cn4NLu24S5mMy9Z14IBdgC:APA91bHdVnV34Lvp-tcA5N_zQErzts9Ht6m_lTxJKe80qzHAC4zA5KpWus5JEL4Bk4CXdHdaiQRGliodwm7Hucq6ehl3rDpR7PnAgoa-v3T6BPTpFn-CN1w');
INSERT INTO public.users VALUES (4, '109389832097474994391', 'hcaoffice.project@gmail.com', 'Hardy Cahaya Abadi', '', 'https://lh3.googleusercontent.com/a/ACg8ocLkqogofa9i_m8ek6lKmZHtHmtt25id_JY-Ho46YxBRUZ1X=s96-c', 'customer', 100, '', true, '2025-11-27 02:07:22.569101+00', '2026-05-21 14:16:49.716248+00', NULL, '', '', NULL, '', 'fPbhswOmQiuNXwldDTbNjd:APA91bEUsnOtcLQMWMl0GfoSCyydMfYW42Vp5tylwbPvpypnUx5rEdY86AA5651eFdLH16u_sRiXOIb9B4Y-v6WNQJFJCzQfS_v8uLygJCFeb1TIP9l5vWE');


--
-- TOC entry 3952 (class 0 OID 17580)
-- Dependencies: 370
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.vehicles VALUES (1, 2, 'car', 'Nissan', 'March', 2025, 'hitam', 'K4LA', '2025-11-26 17:13:16.345943+00', '2025-11-26 17:13:16.345943+00', NULL);
INSERT INTO public.vehicles VALUES (2, 2, 'car', 'honda', 'civic turbo', 2025, 'putih', 'AD 4 m', '2025-11-27 02:01:28.368849+00', '2025-11-27 02:01:28.368849+00', NULL);
INSERT INTO public.vehicles VALUES (3, 4, 'car', 'toyota', 'avanza', 2025, 'putih', 'B1882po', '2025-11-27 06:49:46.232778+00', '2025-11-27 06:49:46.232778+00', NULL);
INSERT INTO public.vehicles VALUES (4, 15, '', '', 'lcgc', 0, '', 'B1234HH', '2026-05-14 10:10:19.076651+00', '2026-05-14 10:10:19.076651+00', NULL);


--
-- TOC entry 3990 (class 0 OID 0)
-- Dependencies: 351
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 124, true);


--
-- TOC entry 3991 (class 0 OID 0)
-- Dependencies: 375
-- Name: attendances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attendances_id_seq', 1, false);


--
-- TOC entry 3992 (class 0 OID 0)
-- Dependencies: 353
-- Name: cash_flows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cash_flows_id_seq', 22, true);


--
-- TOC entry 3993 (class 0 OID 0)
-- Dependencies: 373
-- Name: employee_configs_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employee_configs_user_id_seq', 1, false);


--
-- TOC entry 3994 (class 0 OID 0)
-- Dependencies: 383
-- Name: employee_loans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employee_loans_id_seq', 2, true);


--
-- TOC entry 3995 (class 0 OID 0)
-- Dependencies: 377
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_id_seq', 1, true);


--
-- TOC entry 3996 (class 0 OID 0)
-- Dependencies: 355
-- Name: ledgers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ledgers_id_seq', 36, true);


--
-- TOC entry 3997 (class 0 OID 0)
-- Dependencies: 357
-- Name: memberships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.memberships_id_seq', 6, true);


--
-- TOC entry 3998 (class 0 OID 0)
-- Dependencies: 359
-- Name: payment_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_methods_id_seq', 4, true);


--
-- TOC entry 3999 (class 0 OID 0)
-- Dependencies: 385
-- Name: payrolls_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payrolls_id_seq', 1, false);


--
-- TOC entry 4000 (class 0 OID 0)
-- Dependencies: 361
-- Name: point_configs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.point_configs_id_seq', 1, true);


--
-- TOC entry 4001 (class 0 OID 0)
-- Dependencies: 387
-- Name: service_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.service_categories_id_seq', 4, true);


--
-- TOC entry 4002 (class 0 OID 0)
-- Dependencies: 363
-- Name: services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.services_id_seq', 11, true);


--
-- TOC entry 4003 (class 0 OID 0)
-- Dependencies: 365
-- Name: transaction_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transaction_items_id_seq', 31, true);


--
-- TOC entry 4004 (class 0 OID 0)
-- Dependencies: 367
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 45, true);


--
-- TOC entry 4005 (class 0 OID 0)
-- Dependencies: 369
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 18, true);


--
-- TOC entry 4006 (class 0 OID 0)
-- Dependencies: 371
-- Name: vehicles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vehicles_id_seq', 4, true);


--
-- TOC entry 3711 (class 2606 OID 17598)
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3752 (class 2606 OID 18858)
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);


--
-- TOC entry 3713 (class 2606 OID 17600)
-- Name: cash_flows cash_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT cash_flows_pkey PRIMARY KEY (id);


--
-- TOC entry 3749 (class 2606 OID 18843)
-- Name: employee_configs employee_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_configs
    ADD CONSTRAINT employee_configs_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3758 (class 2606 OID 35005)
-- Name: employee_loans employee_loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_pkey PRIMARY KEY (id);


--
-- TOC entry 3755 (class 2606 OID 18874)
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- TOC entry 3717 (class 2606 OID 17602)
-- Name: ledgers ledgers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledgers
    ADD CONSTRAINT ledgers_pkey PRIMARY KEY (id);


--
-- TOC entry 3721 (class 2606 OID 17604)
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- TOC entry 3724 (class 2606 OID 17606)
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- TOC entry 3760 (class 2606 OID 35026)
-- Name: payrolls payrolls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls
    ADD CONSTRAINT payrolls_pkey PRIMARY KEY (id);


--
-- TOC entry 3726 (class 2606 OID 17608)
-- Name: point_configs point_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_configs
    ADD CONSTRAINT point_configs_pkey PRIMARY KEY (id);


--
-- TOC entry 3747 (class 2606 OID 18833)
-- Name: role_accesses role_accesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_accesses
    ADD CONSTRAINT role_accesses_pkey PRIMARY KEY (role);


--
-- TOC entry 3764 (class 2606 OID 43137)
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3729 (class 2606 OID 17610)
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- TOC entry 3731 (class 2606 OID 17612)
-- Name: transaction_items transaction_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_items
    ADD CONSTRAINT transaction_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3736 (class 2606 OID 17614)
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3741 (class 2606 OID 17616)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3745 (class 2606 OID 17618)
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- TOC entry 3753 (class 1259 OID 18864)
-- Name: idx_attendances_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendances_date ON public.attendances USING btree (date);


--
-- TOC entry 3714 (class 1259 OID 17619)
-- Name: idx_cash_flows_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_flows_deleted_at ON public.cash_flows USING btree (deleted_at);


--
-- TOC entry 3750 (class 1259 OID 18849)
-- Name: idx_employee_configs_device_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_employee_configs_device_user_id ON public.employee_configs USING btree (device_user_id);


--
-- TOC entry 3756 (class 1259 OID 18875)
-- Name: idx_employees_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_deleted_at ON public.employees USING btree (deleted_at);


--
-- TOC entry 3715 (class 1259 OID 17620)
-- Name: idx_ledgers_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledgers_deleted_at ON public.ledgers USING btree (deleted_at);


--
-- TOC entry 3718 (class 1259 OID 17621)
-- Name: idx_memberships_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_deleted_at ON public.memberships USING btree (deleted_at);


--
-- TOC entry 3719 (class 1259 OID 43184)
-- Name: idx_memberships_package_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_package_id ON public.memberships USING btree (package_id);


--
-- TOC entry 3722 (class 1259 OID 17622)
-- Name: idx_payment_methods_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_deleted_at ON public.payment_methods USING btree (deleted_at);


--
-- TOC entry 3761 (class 1259 OID 43138)
-- Name: idx_service_categories_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_categories_deleted_at ON public.service_categories USING btree (deleted_at);


--
-- TOC entry 3762 (class 1259 OID 43139)
-- Name: idx_service_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_service_categories_slug ON public.service_categories USING btree (slug);


--
-- TOC entry 3727 (class 1259 OID 17623)
-- Name: idx_services_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_deleted_at ON public.services USING btree (deleted_at);


--
-- TOC entry 3732 (class 1259 OID 17720)
-- Name: idx_transactions_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_deleted_at ON public.transactions USING btree (deleted_at);


--
-- TOC entry 3733 (class 1259 OID 17625)
-- Name: idx_transactions_transaction_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_transactions_transaction_code ON public.transactions USING btree (transaction_code);


--
-- TOC entry 3734 (class 1259 OID 43183)
-- Name: idx_transactions_tx_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_tx_type ON public.transactions USING btree (tx_type);


--
-- TOC entry 3737 (class 1259 OID 17626)
-- Name: idx_users_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at);


--
-- TOC entry 3738 (class 1259 OID 17627)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 3739 (class 1259 OID 17628)
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_google_id ON public.users USING btree (google_id);


--
-- TOC entry 3742 (class 1259 OID 17629)
-- Name: idx_vehicles_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_deleted_at ON public.vehicles USING btree (deleted_at);


--
-- TOC entry 3743 (class 1259 OID 17630)
-- Name: idx_vehicles_license_plate; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vehicles_license_plate ON public.vehicles USING btree (license_plate);


--
-- TOC entry 3765 (class 2606 OID 17631)
-- Name: activity_logs fk_activity_logs_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3779 (class 2606 OID 18876)
-- Name: attendances fk_attendances_employee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT fk_attendances_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- TOC entry 3780 (class 2606 OID 18859)
-- Name: attendances fk_attendances_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT fk_attendances_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3766 (class 2606 OID 17636)
-- Name: cash_flows fk_cash_flows_creator; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT fk_cash_flows_creator FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 3778 (class 2606 OID 18844)
-- Name: employee_configs fk_employee_configs_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_configs
    ADD CONSTRAINT fk_employee_configs_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3781 (class 2606 OID 35006)
-- Name: employee_loans fk_employee_loans_employee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT fk_employee_loans_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- TOC entry 3767 (class 2606 OID 17641)
-- Name: ledgers fk_ledgers_creator; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledgers
    ADD CONSTRAINT fk_ledgers_creator FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 3768 (class 2606 OID 17646)
-- Name: memberships fk_memberships_transaction; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT fk_memberships_transaction FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);


--
-- TOC entry 3782 (class 2606 OID 35027)
-- Name: payrolls fk_payrolls_employee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls
    ADD CONSTRAINT fk_payrolls_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- TOC entry 3771 (class 2606 OID 17651)
-- Name: transaction_items fk_transaction_items_service; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_items
    ADD CONSTRAINT fk_transaction_items_service FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- TOC entry 3773 (class 2606 OID 17656)
-- Name: transactions fk_transactions_cashier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_cashier FOREIGN KEY (cashier_id) REFERENCES public.users(id);


--
-- TOC entry 3772 (class 2606 OID 17661)
-- Name: transaction_items fk_transactions_items; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_items
    ADD CONSTRAINT fk_transactions_items FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);


--
-- TOC entry 3774 (class 2606 OID 17666)
-- Name: transactions fk_transactions_payment_method; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_payment_method FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);


--
-- TOC entry 3769 (class 2606 OID 17671)
-- Name: memberships fk_users_memberships; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT fk_users_memberships FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3775 (class 2606 OID 17676)
-- Name: transactions fk_users_transactions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_users_transactions FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3777 (class 2606 OID 17681)
-- Name: vehicles fk_users_vehicles; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT fk_users_vehicles FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3770 (class 2606 OID 17686)
-- Name: memberships fk_vehicles_memberships; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT fk_vehicles_memberships FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 3776 (class 2606 OID 43110)
-- Name: transactions transactions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


-- Completed on 2026-06-04 23:09:28 WIB

--
-- PostgreSQL database dump complete
--

