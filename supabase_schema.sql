-- ============================================================
-- COMPASS — Schema SQL para Supabase
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- EXTENSIONES
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLA: profiles (roles de usuario)
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('admin', 'operator', 'reader')),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: cuentas_bancarias
-- ============================================================
create table if not exists cuentas_bancarias (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  tipo text not null check (tipo in ('corriente_pesos', 'corriente_especial', 'corriente_dolares', 'tarjeta')),
  banco text default 'Banco Macro',
  activa boolean default true,
  created_at timestamptz default now()
);

-- Insertar cuentas por defecto
insert into cuentas_bancarias (nombre, tipo) values
  ('Cuenta Corriente Común', 'corriente_pesos'),
  ('Cuenta Corriente Especial', 'corriente_especial'),
  ('Cuenta Corriente Dólares', 'corriente_dolares')
on conflict do nothing;

-- ============================================================
-- TABLA: movimientos (tesorería - conciliación bancaria)
-- ============================================================
create table if not exists movimientos (
  id uuid default uuid_generate_v4() primary key,
  cuenta_id uuid references cuentas_bancarias(id),
  fecha date not null,
  concepto text,
  tipo text not null check (tipo in ('credito', 'debito')),
  importe numeric(15,2) not null default 0,
  divisa text default 'ARS' check (divisa in ('ARS', 'USD')),
  categoria text default 'General',
  mes integer not null,
  anio integer not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: tarjetas_movimientos (conciliación tarjetas)
-- ============================================================
create table if not exists tarjetas_movimientos (
  id uuid default uuid_generate_v4() primary key,
  fecha date not null,
  tarjeta text not null,
  concepto text,
  importe numeric(15,2) not null default 0,
  mes integer not null,
  anio integer not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: extractos (archivos PDF adjuntos)
-- ============================================================
create table if not exists extractos (
  id uuid default uuid_generate_v4() primary key,
  cuenta_id uuid references cuentas_bancarias(id),
  periodo text not null,
  archivo_url text,
  archivo_nombre text,
  mes integer not null,
  anio integer not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: clientes_db (base de datos de clientes)
-- ============================================================
create table if not exists clientes_db (
  id uuid default uuid_generate_v4() primary key,
  razon_social text not null,
  cuit text,
  email text,
  telefono text,
  observaciones text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: clientes_movimientos (facturas y cobros)
-- ============================================================
create table if not exists clientes_movimientos (
  id uuid default uuid_generate_v4() primary key,
  cliente_id uuid references clientes_db(id),
  cliente_nombre text not null,
  fecha_factura date not null,
  nro_factura text,
  importe numeric(15,2) not null default 0,
  importe_abonado numeric(15,2) default 0,
  prepago numeric(15,2) default 0,
  divisa text default 'ARS' check (divisa in ('ARS', 'USD')),
  medio_pago text default 'Transferencia Macro CC $',
  mes integer not null,
  anio integer not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: proveedores_db (base de datos de proveedores)
-- ============================================================
create table if not exists proveedores_db (
  id uuid default uuid_generate_v4() primary key,
  razon_social text not null,
  cuit text,
  email text,
  telefono text,
  observaciones text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: proveedores_movimientos (facturas a pagar)
-- ============================================================
create table if not exists proveedores_movimientos (
  id uuid default uuid_generate_v4() primary key,
  proveedor_id uuid references proveedores_db(id),
  proveedor_nombre text not null,
  fecha_factura date not null,
  nro_factura text,
  importe numeric(15,2) not null default 0,
  importe_abonado numeric(15,2) default 0,
  divisa text default 'ARS' check (divisa in ('ARS', 'USD')),
  fecha_vencimiento date,
  forma_pago text default 'Transferencia Macro CC $',
  abonado boolean default false,
  mes integer not null,
  anio integer not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: egrs (egresos / no proveedores)
-- ============================================================
create table if not exists egrs (
  id uuid default uuid_generate_v4() primary key,
  entidad text not null,
  nro_comprobante text,
  concepto text,
  fecha_vencimiento date,
  divisa text default 'ARS' check (divisa in ('ARS', 'USD')),
  importe numeric(15,2) not null default 0,
  observaciones text,
  abonado boolean default false,
  mes integer not null,
  anio integer not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: aportes_socios
-- ============================================================
create table if not exists aportes_socios (
  id uuid default uuid_generate_v4() primary key,
  fecha date not null,
  socio text not null,
  concepto text default 'Aporte de Capital',
  divisa text default 'ARS' check (divisa in ('ARS', 'USD')),
  importe numeric(15,2) not null default 0,
  mes integer not null,
  anio integer not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Todos los usuarios autenticados pueden leer.
-- Solo admin y operator pueden escribir.
-- ============================================================

alter table profiles enable row level security;
alter table cuentas_bancarias enable row level security;
alter table movimientos enable row level security;
alter table tarjetas_movimientos enable row level security;
alter table extractos enable row level security;
alter table clientes_db enable row level security;
alter table clientes_movimientos enable row level security;
alter table proveedores_db enable row level security;
alter table proveedores_movimientos enable row level security;
alter table egrs enable row level security;
alter table aportes_socios enable row level security;

-- Policies: lectura para todos los autenticados
create policy "Lectura autenticados" on profiles for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on cuentas_bancarias for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on movimientos for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on tarjetas_movimientos for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on extractos for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on clientes_db for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on clientes_movimientos for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on proveedores_db for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on proveedores_movimientos for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on egrs for select using (auth.role() = 'authenticated');
create policy "Lectura autenticados" on aportes_socios for select using (auth.role() = 'authenticated');

-- Policies: escritura solo admin y operator
create policy "Escritura admin y operator" on movimientos for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'operator'))
);
create policy "Escritura admin y operator" on tarjetas_movimientos for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'operator'))
);
create policy "Escritura admin y operator" on extractos for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'operator'))
);
create policy "Escritura admin y operator" on clientes_db for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'operator'))
);
create policy "Escritura admin y operator" on clientes_movimientos for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'operator'))
);
create policy "Escritura admin y operator" on proveedores_db for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'operator'))
);
create policy "Escritura admin y operator" on proveedores_movimientos for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'operator'))
);
create policy "Escritura admin y operator" on egrs for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'operator'))
);
create policy "Escritura admin y operator" on aportes_socios for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'operator'))
);
-- Solo admin puede ver/editar cuentas bancarias y profiles
create policy "Solo admin cuentas" on cuentas_bancarias for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Solo admin profiles" on profiles for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Trigger: crear perfil automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'reader'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
