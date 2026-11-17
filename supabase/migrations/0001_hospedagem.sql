-- =====================================================================
-- Soul Hospedagem: estrutura do banco de dados (PostgreSQL / Supabase)
-- Sistema de gestão para pousadas e hotéis.
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

-- Extensão que permite impedir duas reservas no mesmo quarto e período
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
-- pendente: acabou de se cadastrar e aguarda liberação do administrador
create type public.user_role as enum ('pendente', 'recepcao', 'governanca', 'admin');

create type public.property_kind as enum ('pousada', 'hotel');

-- Situação de limpeza/arrumação do quarto (governança)
create type public.housekeeping_status as enum ('limpo', 'sujo', 'manutencao');

create type public.reservation_status as enum (
  'confirmada',  -- reservado, hóspede ainda não chegou
  'hospedado',   -- check-in feito
  'finalizada',  -- check-out feito
  'cancelada',
  'no_show'      -- não compareceu
);

create type public.product_category as enum ('frigobar', 'restaurante', 'servico');

create type public.payment_method as enum (
  'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia'
);

-- ---------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------

-- Perfil de cada usuário (complementa auth.users, que é do Supabase)
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  email      text not null default '',
  role       public.user_role not null default 'pendente',
  created_at timestamptz not null default now()
);

-- Dados do estabelecimento (sempre uma única linha)
create table public.settings (
  id            integer primary key default 1 check (id = 1),
  property_name text not null default 'Minha Pousada' check (char_length(property_name) between 2 and 80),
  property_kind public.property_kind not null default 'pousada',
  checkin_time  time not null default '14:00',
  checkout_time time not null default '12:00',
  phone         text not null default '',
  address       text not null default ''
);

-- Tipos de quarto/acomodação (Standard, Luxo, Chalé...)
create table public.room_types (
  id          bigint generated always as identity primary key,
  name        text not null unique check (char_length(name) between 2 and 60),
  capacity    integer not null default 2 check (capacity between 1 and 20),
  base_rate   numeric(10, 2) not null default 0 check (base_rate >= 0),
  description text not null default '',
  active      boolean not null default true
);

-- Quartos / unidades
create table public.rooms (
  id           bigint generated always as identity primary key,
  number       text not null unique check (char_length(number) between 1 and 20),
  room_type_id bigint not null references public.room_types (id),
  floor        text not null default '',
  housekeeping public.housekeeping_status not null default 'limpo',
  notes        text not null default '',
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

-- Hóspedes
create table public.guests (
  id         bigint generated always as identity primary key,
  full_name  text not null check (char_length(full_name) between 3 and 120),
  document   text not null default '',  -- CPF, RG ou passaporte
  phone      text not null default '',
  email      text not null default '',
  birth_date date,
  city       text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now()
);

create unique index guests_document_key on public.guests (document) where document <> '';
create index guests_name_idx on public.guests (lower(full_name));

-- Reservas / estadias
create table public.reservations (
  id             bigint generated always as identity primary key,
  guest_id       bigint not null references public.guests (id),
  room_id        bigint not null references public.rooms (id),
  check_in       date not null,
  check_out      date not null,
  adults         integer not null default 1 check (adults between 1 and 20),
  children       integer not null default 0 check (children between 0 and 20),
  daily_rate     numeric(10, 2) check (daily_rate >= 0),
  status         public.reservation_status not null default 'confirmada',
  source         text not null default 'balcao',
  notes          text not null default '',
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  cancelled_at   timestamptz,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint reservations_dates_check check (check_out > check_in),
  -- O mesmo quarto não pode ter duas reservas ativas no mesmo período.
  -- A saída de um hóspede pode ser no mesmo dia da entrada do próximo.
  constraint reservations_no_overlap exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status in ('confirmada', 'hospedado'))
);

create index reservations_status_idx on public.reservations (status);
create index reservations_guest_idx  on public.reservations (guest_id);
create index reservations_dates_idx  on public.reservations (check_in, check_out);

-- Produtos e serviços cobrados à parte (frigobar, restaurante, lavanderia...)
create table public.products (
  id       bigint generated always as identity primary key,
  name     text not null unique check (char_length(name) between 2 and 80),
  category public.product_category not null default 'frigobar',
  price    numeric(10, 2) not null check (price >= 0),
  active   boolean not null default true
);

-- Consumo lançado na conta do hóspede
create table public.charges (
  id             bigint generated always as identity primary key,
  reservation_id bigint not null references public.reservations (id) on delete cascade,
  product_id     bigint references public.products (id) on delete set null,
  description    text not null default '',
  quantity       integer not null default 1 check (quantity between 1 and 999),
  unit_price     numeric(10, 2) check (unit_price >= 0),
  total          numeric(12, 2) generated always as (quantity * unit_price) stored,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index charges_reservation_idx on public.charges (reservation_id);

-- Pagamentos recebidos (sinal, diárias, consumo)
create table public.payments (
  id             bigint generated always as identity primary key,
  reservation_id bigint not null references public.reservations (id) on delete cascade,
  amount         numeric(10, 2) not null check (amount > 0),
  method         public.payment_method not null default 'pix',
  notes          text not null default '',
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index payments_reservation_idx on public.payments (reservation_id);

-- ---------------------------------------------------------------------
-- 3. Funções auxiliares
-- ---------------------------------------------------------------------

-- "Hoje" no fuso de Brasília (o servidor do Supabase roda em UTC)
create function public.today()
returns date
language sql stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create function public.app_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Qualquer funcionário liberado (recepção, governança ou admin)
create function public.is_active()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.app_role() <> 'pendente', false);
$$;

-- Recepção: reservas, hóspedes e caixa
create function public.is_front()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.app_role() in ('recepcao', 'admin'), false);
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.app_role() = 'admin', false);
$$;

-- Saldo de uma reserva: diárias + consumo - pagamentos
create function public.reservation_balance(
  p_reservation_id bigint, p_check_in date, p_check_out date, p_daily_rate numeric
)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select (p_check_out - p_check_in) * coalesce(p_daily_rate, 0)
       + coalesce((select sum(total) from public.charges where reservation_id = p_reservation_id), 0)
       - coalesce((select sum(amount) from public.payments where reservation_id = p_reservation_id), 0);
$$;

-- Uso interno (check-out): não fica exposta na API
revoke execute on function public.reservation_balance(bigint, date, date, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Regras automáticas (triggers)
-- ---------------------------------------------------------------------

-- 4.1 Cria o perfil quando alguém se cadastra.
--     O PRIMEIRO usuário vira administrador; os demais aguardam liberação.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    case
      when exists (select 1 from public.profiles where role = 'admin')
        then 'pendente'::public.user_role
      else 'admin'::public.user_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.2 Só administradores mudam o perfil de acesso; sempre deve existir um admin.
create function public.protect_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;

  if new.role is distinct from old.role then
    -- auth.uid() nulo = alteração feita direto no SQL Editor (permitido)
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Apenas administradores podem alterar o perfil de acesso';
    end if;
    if old.role = 'admin' and not exists (
      select 1 from public.profiles where role = 'admin' and id <> old.id
    ) then
      raise exception 'O sistema precisa de pelo menos um administrador';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile();

-- 4.3 Quartos: governança e recepção só mudam a situação de limpeza e as observações.
create function public.protect_room()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null and not public.is_admin() then
    if new.number <> old.number
       or new.room_type_id <> old.room_type_id
       or new.floor <> old.floor
       or new.active <> old.active then
      raise exception 'Apenas administradores alteram o cadastro de quartos';
    end if;
  end if;
  return new;
end;
$$;

create trigger rooms_protect
  before update on public.rooms
  for each row execute function public.protect_room();

-- 4.4 Nova reserva: começa "confirmada", diária padrão do tipo de quarto
--     e respeita a capacidade do quarto.
create function public.reservation_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_capacity integer;
  v_rate     numeric;
  v_active   boolean;
begin
  new.status := 'confirmada';
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();
  new.updated_at := now();
  new.checked_in_at := null;
  new.checked_out_at := null;
  new.cancelled_at := null;

  select t.capacity, t.base_rate, r.active and t.active
    into v_capacity, v_rate, v_active
    from public.rooms r join public.room_types t on t.id = r.room_type_id
   where r.id = new.room_id;

  if not found or not v_active then
    raise exception 'Quarto inexistente ou desativado';
  end if;
  if new.adults + new.children > v_capacity then
    raise exception 'Este quarto comporta no máximo % pessoa(s)', v_capacity;
  end if;
  if auth.uid() is not null and new.check_in < public.today() then
    raise exception 'A data de entrada não pode ser no passado';
  end if;

  new.daily_rate := coalesce(new.daily_rate, v_rate);
  return new;
end;
$$;

create trigger reservations_before_insert
  before insert on public.reservations
  for each row execute function public.reservation_before_insert();

-- 4.5 Alteração de reserva: check-in, check-out, cancelamento e troca de quarto.
create function public.reservation_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_capacity    integer;
  v_housekeep   public.housekeeping_status;
  v_room_number text;
  v_balance     numeric;
begin
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();

  -- Reserva encerrada: só as observações podem mudar
  if old.status in ('finalizada', 'cancelada', 'no_show') then
    if (new.status, new.guest_id, new.room_id, new.check_in, new.check_out,
        new.daily_rate, new.adults, new.children)
       is distinct from
       (old.status, old.guest_id, old.room_id, old.check_in, old.check_out,
        old.daily_rate, old.adults, old.children) then
      raise exception 'Esta reserva já foi encerrada e não pode ser alterada';
    end if;
    return new;
  end if;

  -- Depois do check-in, o hóspede e a data de entrada ficam fixos
  if old.status = 'hospedado' then
    if new.guest_id <> old.guest_id or new.check_in <> old.check_in then
      raise exception 'Hóspede e data de entrada não mudam depois do check-in';
    end if;
  end if;

  -- Mudança de situação
  if new.status <> old.status then
    if old.status = 'confirmada' and new.status = 'hospedado' then
      if public.today() < new.check_in then
        raise exception 'O check-in desta reserva é a partir de %', to_char(new.check_in, 'DD/MM/YYYY');
      end if;
      if public.today() >= new.check_out then
        raise exception 'O período desta reserva já terminou. Ajuste as datas antes do check-in';
      end if;
      select housekeeping, number into v_housekeep, v_room_number
        from public.rooms where id = new.room_id;
      if v_housekeep <> 'limpo' then
        raise exception 'O quarto % ainda não foi liberado pela governança', v_room_number;
      end if;
      new.checked_in_at := now();

    elsif old.status = 'hospedado' and new.status = 'finalizada' then
      -- Saída antecipada: cobra até hoje (mínimo uma diária) e libera o quarto
      if public.today() < new.check_out then
        new.check_out := greatest(public.today(), new.check_in + 1);
      end if;
      v_balance := public.reservation_balance(new.id, new.check_in, new.check_out, new.daily_rate);
      if v_balance > 0 then
        raise exception 'Há saldo em aberto de R$ %. Registre o pagamento antes do check-out',
          replace(to_char(v_balance, 'FM999G999G990D00'), '.', ',');
      end if;
      new.checked_out_at := now();
      update public.rooms set housekeeping = 'sujo' where id = new.room_id;

    elsif old.status = 'confirmada' and new.status = 'cancelada' then
      new.cancelled_at := now();

    elsif old.status = 'confirmada' and new.status = 'no_show' then
      if public.today() < new.check_in then
        raise exception 'Só é possível marcar "não compareceu" a partir da data de entrada';
      end if;
      new.cancelled_at := now();

    else
      raise exception 'Mudança de situação não permitida (% para %)', old.status, new.status;
    end if;
  end if;

  -- Troca de quarto ou de número de pessoas: confere a capacidade
  if new.room_id <> old.room_id or new.adults <> old.adults or new.children <> old.children then
    select t.capacity into v_capacity
      from public.rooms r join public.room_types t on t.id = r.room_type_id
     where r.id = new.room_id and r.active;
    if not found then
      raise exception 'Quarto inexistente ou desativado';
    end if;
    if new.adults + new.children > v_capacity then
      raise exception 'Este quarto comporta no máximo % pessoa(s)', v_capacity;
    end if;
  end if;

  -- Troca de quarto com o hóspede já na casa: novo quarto precisa estar limpo,
  -- e o anterior vai para a limpeza
  if new.room_id <> old.room_id and new.status = 'hospedado' then
    select housekeeping, number into v_housekeep, v_room_number
      from public.rooms where id = new.room_id;
    if v_housekeep <> 'limpo' then
      raise exception 'O quarto % ainda não foi liberado pela governança', v_room_number;
    end if;
    update public.rooms set housekeeping = 'sujo' where id = old.room_id;
  end if;

  return new;
end;
$$;

create trigger reservations_before_update
  before update on public.reservations
  for each row execute function public.reservation_before_update();

-- 4.6 Consumo: só para hóspedes na casa; preço vem do cadastro do produto.
create function public.charge_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.reservation_status;
  v_name   text;
  v_price  numeric;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();

  select status into v_status from public.reservations where id = new.reservation_id;
  if v_status is distinct from 'hospedado' then
    raise exception 'Só é possível lançar consumo para hóspedes com check-in feito';
  end if;

  if new.product_id is not null then
    select name, price into v_name, v_price
      from public.products where id = new.product_id and active;
    if not found then
      raise exception 'Produto inexistente ou desativado';
    end if;
    new.unit_price := v_price;
    if new.description = '' then
      new.description := v_name;
    end if;
  else
    -- Lançamento avulso: só a recepção, com descrição e valor
    if auth.uid() is not null and not public.is_front() then
      raise exception 'Lançamento avulso é permitido apenas para a recepção';
    end if;
    if char_length(new.description) < 2 or new.unit_price is null then
      raise exception 'Informe a descrição e o valor do lançamento';
    end if;
  end if;
  return new;
end;
$$;

create trigger charges_before_insert
  before insert on public.charges
  for each row execute function public.charge_before_insert();

-- 4.7 Pagamento: só em reservas ativas (sinal antes da chegada ou durante a estadia).
create function public.payment_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.reservation_status;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();

  select status into v_status from public.reservations where id = new.reservation_id;
  if v_status is null or v_status not in ('confirmada', 'hospedado') then
    raise exception 'Pagamentos só podem ser lançados em reservas ativas';
  end if;
  return new;
end;
$$;

create trigger payments_before_insert
  before insert on public.payments
  for each row execute function public.payment_before_insert();

-- ---------------------------------------------------------------------
-- 5. Resumo financeiro de cada reserva
--    security_invoker: respeita as permissões de quem consulta
-- ---------------------------------------------------------------------
create view public.reservation_totals
with (security_invoker = true)
as
select
  r.id                                        as reservation_id,
  (r.check_out - r.check_in)                  as nights,
  (r.check_out - r.check_in) * r.daily_rate   as lodging_total,
  coalesce(c.total, 0)                        as charges_total,
  coalesce(p.total, 0)                        as payments_total,
  (r.check_out - r.check_in) * r.daily_rate
    + coalesce(c.total, 0) - coalesce(p.total, 0) as balance
from public.reservations r
left join lateral (
  select sum(total) as total from public.charges where reservation_id = r.id
) c on true
left join lateral (
  select sum(amount) as total from public.payments where reservation_id = r.id
) p on true;

-- ---------------------------------------------------------------------
-- 6. Segurança por linha (RLS): cada perfil vê e faz só o que pode
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.settings     enable row level security;
alter table public.room_types   enable row level security;
alter table public.rooms        enable row level security;
alter table public.guests       enable row level security;
alter table public.reservations enable row level security;
alter table public.products     enable row level security;
alter table public.charges      enable row level security;
alter table public.payments     enable row level security;

-- Perfis
create policy "Ver o próprio perfil ou, se funcionário, todos"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active());

create policy "Editar o próprio perfil ou, se admin, qualquer um"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Configurações, tipos de quarto e produtos: funcionários veem, admin altera
create policy "Funcionários veem as configurações"
  on public.settings for select to authenticated using (public.is_active());
create policy "Admin altera as configurações"
  on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Funcionários veem os tipos de quarto"
  on public.room_types for select to authenticated using (public.is_active());
create policy "Admin gerencia tipos de quarto"
  on public.room_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Funcionários veem os produtos"
  on public.products for select to authenticated using (public.is_active());
create policy "Admin gerencia produtos"
  on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Quartos: todos veem e atualizam a limpeza (regras no trigger); admin cria e exclui
create policy "Funcionários veem os quartos"
  on public.rooms for select to authenticated using (public.is_active());
create policy "Funcionários atualizam a situação do quarto"
  on public.rooms for update to authenticated
  using (public.is_active()) with check (public.is_active());
create policy "Admin cria quartos"
  on public.rooms for insert to authenticated with check (public.is_admin());
create policy "Admin exclui quartos"
  on public.rooms for delete to authenticated using (public.is_admin());

-- Hóspedes (dados pessoais: só recepção e admin)
create policy "Recepção vê os hóspedes"
  on public.guests for select to authenticated using (public.is_front());
create policy "Recepção cadastra hóspedes"
  on public.guests for insert to authenticated with check (public.is_front());
create policy "Recepção atualiza hóspedes"
  on public.guests for update to authenticated
  using (public.is_front()) with check (public.is_front());
create policy "Admin exclui hóspedes"
  on public.guests for delete to authenticated using (public.is_admin());

-- Reservas: governança vê (para saber o que está ocupado), recepção gerencia
create policy "Funcionários veem as reservas"
  on public.reservations for select to authenticated using (public.is_active());
create policy "Recepção cria reservas"
  on public.reservations for insert to authenticated with check (public.is_front());
create policy "Recepção atualiza reservas (regras no trigger)"
  on public.reservations for update to authenticated
  using (public.is_front()) with check (public.is_front());
create policy "Admin exclui reservas"
  on public.reservations for delete to authenticated using (public.is_admin());

-- Consumo: qualquer funcionário lança (a camareira confere o frigobar);
-- estorno só pela recepção e enquanto o hóspede está na casa
create policy "Funcionários veem o consumo"
  on public.charges for select to authenticated using (public.is_active());
create policy "Funcionários lançam consumo"
  on public.charges for insert to authenticated with check (public.is_active());
create policy "Recepção estorna consumo de hóspede na casa"
  on public.charges for delete to authenticated
  using (
    public.is_front()
    and exists (
      select 1 from public.reservations r
      where r.id = reservation_id and r.status = 'hospedado'
    )
  );

-- Pagamentos: recepção registra; só admin exclui
create policy "Recepção vê os pagamentos"
  on public.payments for select to authenticated using (public.is_front());
create policy "Recepção registra pagamentos"
  on public.payments for insert to authenticated with check (public.is_front());
create policy "Admin exclui pagamentos"
  on public.payments for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. Dados iniciais (exemplo: edite à vontade em Administração)
-- ---------------------------------------------------------------------
insert into public.settings (id) values (1);

insert into public.room_types (name, capacity, base_rate, description) values
  ('Standard', 2, 220.00, 'Cama de casal ou duas de solteiro'),
  ('Luxo',     3, 340.00, 'Varanda e banheira'),
  ('Família',  5, 450.00, 'Cama de casal e beliche');

insert into public.rooms (number, room_type_id, floor) values
  ('101', 1, '1º andar'), ('102', 1, '1º andar'), ('103', 1, '1º andar'),
  ('201', 2, '2º andar'), ('202', 2, '2º andar'),
  ('301', 3, '3º andar');

insert into public.products (name, category, price) values
  ('Água mineral 500 ml',  'frigobar',    6.00),
  ('Refrigerante lata',    'frigobar',    8.00),
  ('Cerveja long neck',    'frigobar',   14.00),
  ('Chocolate',            'frigobar',    9.00),
  ('Castanhas',            'frigobar',   12.00),
  ('Café da manhã extra',  'restaurante', 45.00),
  ('Porção de petiscos',   'restaurante', 48.00),
  ('Lavanderia (peça)',    'servico',    15.00),
  ('Late check-out',       'servico',    90.00);
