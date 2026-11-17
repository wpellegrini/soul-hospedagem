// Testa o banco de dados localmente, sem Supabase, usando PGlite (PostgreSQL em WebAssembly).
// Uso: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/0001_hospedagem.sql", import.meta.url),
  "utf8",
);

// Simula o que o Supabase já traz pronto: schemas auth/extensions, auth.uid() e os papéis.
const supabaseShim = `
  create schema extensions;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

const db = new PGlite({ extensions: { btree_gist } });
let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`  FALHOU  ${name}`);
  }
}

async function expectError(name, fn, fragment) {
  try {
    await fn();
    check(`${name} (deveria falhar)`, false);
  } catch (e) {
    const ok = fragment ? String(e.message).includes(fragment) : true;
    if (!ok) console.log(`        erro recebido: ${e.message}`);
    check(name, ok);
  }
}

// Executa como um usuário logado (papel "authenticated" + auth.uid())
async function as(userId, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
    await tx.exec(`set local role authenticated`);
    return tx.query(sql, params);
  });
}

async function one(userId, sql, params = []) {
  return (await as(userId, sql, params)).rows[0];
}

async function createUser(email, name) {
  const r = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ full_name: name })],
  );
  return r.rows[0].id;
}

const roomId = async (number) =>
  (await db.query(`select id from public.rooms where number=$1`, [number])).rows[0].id;
const housekeeping = async (number) =>
  (await db.query(`select housekeeping from public.rooms where number=$1`, [number])).rows[0].housekeeping;
const statusOf = async (id) =>
  (await db.query(`select status from public.reservations where id=$1`, [id])).rows[0].status;

await db.exec(supabaseShim);
await db.exec(migration);
console.log("Migração aplicada.\n");

// Datas relativas a "hoje" no fuso de Brasília
const d = async (offset) =>
  (await db.query(`select to_char(public.today() + $1::int, 'YYYY-MM-DD') as d`, [offset])).rows[0].d;
const [ontem, hoje, amanha, d2, d3, d5] = await Promise.all([-1, 0, 1, 2, 3, 5].map(d));

console.log("Cadastro e perfis");
const admin = await createUser("admin@pousada.com", "Ana Admin");
const recep = await createUser("recepcao@pousada.com", "Rui Recepção");
const camareira = await createUser("gov@pousada.com", "Gina Governança");
const novato = await createUser("novo@pousada.com", "Nilo Novato");

const roles = Object.fromEntries(
  (await db.query(`select email, role from public.profiles`)).rows.map((r) => [r.email, r.role]),
);
check("primeiro usuário vira admin", roles["admin@pousada.com"] === "admin");
check("demais usuários entram como pendentes", roles["novo@pousada.com"] === "pendente");

await expectError(
  "pendente não consegue se liberar sozinho",
  () => as(novato, `update public.profiles set role='admin' where id=$1`, [novato]),
  "Apenas administradores",
);
await as(admin, `update public.profiles set role='recepcao' where id=$1`, [recep]);
await as(admin, `update public.profiles set role='governanca' where id=$1`, [camareira]);
check(
  "admin libera recepção e governança",
  (await db.query(`select count(*)::int n from public.profiles where role in ('recepcao','governanca')`)).rows[0].n === 2,
);
await expectError(
  "último admin não pode deixar de ser admin",
  () => as(admin, `update public.profiles set role='recepcao' where id=$1`, [admin]),
  "pelo menos um administrador",
);
check("pendente não vê quartos", (await as(novato, `select id from public.rooms`)).rows.length === 0);
check("pendente não vê reservas", (await as(novato, `select id from public.reservations`)).rows.length === 0);
check("governança vê quartos", (await as(camareira, `select id from public.rooms`)).rows.length === 6);
check(
  "visitante sem login não vê nada",
  (
    await db.transaction(async (tx) => {
      await tx.exec(`set local role anon`);
      return tx.query(`select id from public.rooms`);
    })
  ).rows.length === 0,
);

console.log("\nHóspedes");
const guest = (
  await one(recep, `insert into public.guests (full_name, document, phone) values ('Maria Souza', '123.456.789-00', '11999990000') returning id`)
).id;
const guest2 = (await one(recep, `insert into public.guests (full_name) values ('João Lima') returning id`)).id;
check("recepção cadastra hóspede", Boolean(guest));
await expectError(
  "documento não se repete",
  () => as(recep, `insert into public.guests (full_name, document) values ('Outra Pessoa', '123.456.789-00')`),
);
check("governança não vê dados de hóspedes", (await as(camareira, `select id from public.guests`)).rows.length === 0);
await expectError(
  "governança não cadastra hóspede",
  () => as(camareira, `insert into public.guests (full_name) values ('Teste Gov')`),
);

console.log("\nReservas");
const r101 = await roomId("101");
const r102 = await roomId("102");
const res1 = await one(
  recep,
  `insert into public.reservations (guest_id, room_id, check_in, check_out, adults, status)
   values ($1, $2, $3, $4, 2, 'finalizada') returning id, status, daily_rate, created_by`,
  [guest, r101, hoje, d3],
);
check("reserva começa como 'confirmada'", res1.status === "confirmada");
check("diária padrão vem do tipo de quarto (Standard = 220)", Number(res1.daily_rate) === 220);
check("quem criou é o usuário logado", res1.created_by === recep);

await expectError(
  "não aceita reserva sobreposta no mesmo quarto",
  () =>
    as(recep, `insert into public.reservations (guest_id, room_id, check_in, check_out) values ($1, $2, $3, $4)`, [
      guest2, r101, amanha, d5,
    ]),
  "reservations_no_overlap",
);
const back = await one(
  recep,
  `insert into public.reservations (guest_id, room_id, check_in, check_out, daily_rate) values ($1, $2, $3, $4, 200) returning id`,
  [guest2, r101, d3, d5],
);
check("saída e entrada no mesmo dia são permitidas", Boolean(back.id));
await expectError(
  "capacidade do quarto é respeitada",
  () =>
    as(recep, `insert into public.reservations (guest_id, room_id, check_in, check_out, adults, children) values ($1, $2, $3, $4, 2, 1)`, [
      guest2, r102, hoje, amanha,
    ]),
  "no máximo 2",
);
await expectError(
  "entrada não pode ser no passado",
  () => as(recep, `insert into public.reservations (guest_id, room_id, check_in, check_out) values ($1, $2, $3, $4)`, [guest2, r102, ontem, amanha]),
  "passado",
);
await expectError(
  "saída precisa ser depois da entrada",
  () => as(recep, `insert into public.reservations (guest_id, room_id, check_in, check_out) values ($1, $2, $3, $3)`, [guest2, r102, amanha]),
);
await expectError(
  "governança não cria reserva",
  () => as(camareira, `insert into public.reservations (guest_id, room_id, check_in, check_out) values ($1, $2, $3, $4)`, [guest2, r102, amanha, d2]),
);
check("governança vê as reservas (mapa de ocupação)", (await as(camareira, `select id from public.reservations`)).rows.length === 2);

console.log("\nCheck-in");
await expectError(
  "check-in antes da data de entrada é bloqueado",
  () => as(recep, `update public.reservations set status='hospedado' where id=$1`, [back.id]),
  "a partir de",
);
await db.query(`update public.rooms set housekeeping='sujo' where number='101'`);
await expectError(
  "check-in bloqueado com quarto sujo",
  () => as(recep, `update public.reservations set status='hospedado' where id=$1`, [res1.id]),
  "governança",
);
await as(camareira, `update public.rooms set housekeeping='limpo' where id=$1`, [r101]);
check("governança libera o quarto", (await housekeeping("101")) === "limpo");
await expectError(
  "governança não muda o cadastro do quarto",
  () => as(camareira, `update public.rooms set number='999' where id=$1`, [r101]),
  "Apenas administradores",
);
const ci = await one(recep, `update public.reservations set status='hospedado' where id=$1 returning status, checked_in_at`, [res1.id]);
check("check-in registra data e hora", ci.status === "hospedado" && ci.checked_in_at !== null);
await expectError(
  "hóspede não muda depois do check-in",
  () => as(recep, `update public.reservations set guest_id=$1 where id=$2`, [guest2, res1.id]),
  "não mudam depois do check-in",
);

console.log("\nConsumo (frigobar)");
const agua = (await db.query(`select id from public.products where name like 'Água%'`)).rows[0].id;
const cerveja = (await db.query(`select id from public.products where name like 'Cerveja%'`)).rows[0].id;
const c1 = await one(camareira, `insert into public.charges (reservation_id, product_id, quantity, unit_price) values ($1, $2, 2, 0.01) returning total, description`, [res1.id, agua]);
check("governança lança frigobar; preço vem do cadastro (2 × 6 = 12)", Number(c1.total) === 12);
check("descrição vem do produto", c1.description.startsWith("Água"));
await as(recep, `insert into public.charges (reservation_id, product_id, quantity) values ($1, $2, 1)`, [res1.id, cerveja]);
await expectError(
  "governança não faz lançamento avulso",
  () => as(camareira, `insert into public.charges (reservation_id, description, unit_price) values ($1, 'Taxa', 50)`, [res1.id]),
  "apenas para a recepção",
);
await as(recep, `insert into public.charges (reservation_id, description, unit_price) values ($1, 'Taxa de pet', 50)`, [res1.id]);
await expectError(
  "não lança consumo em reserva sem check-in",
  () => as(recep, `insert into public.charges (reservation_id, product_id) values ($1, $2)`, [back.id, agua]),
  "check-in feito",
);
const del = await as(camareira, `delete from public.charges where reservation_id=$1 returning id`, [res1.id]);
check("governança não estorna consumo", del.rows.length === 0);

console.log("\nPagamentos e check-out");
await expectError(
  "governança não registra pagamento",
  () => as(camareira, `insert into public.payments (reservation_id, amount) values ($1, 10)`, [res1.id]),
);
check("governança não vê pagamentos", (await as(camareira, `select id from public.payments`)).rows.length === 0);
const tot = await one(recep, `select nights, lodging_total, charges_total, balance from public.reservation_totals where reservation_id=$1`, [res1.id]);
check("3 diárias × 220 = 660", Number(tot.nights) === 3 && Number(tot.lodging_total) === 660);
check("consumo total = 12 + 14 + 50 = 76", Number(tot.charges_total) === 76);
check("saldo = 736", Number(tot.balance) === 736);

await as(recep, `insert into public.payments (reservation_id, amount, method) values ($1, 300, 'pix')`, [res1.id]);
// Saída antecipada (hoje): cobra 1 diária = 220 + 76 - 300 = -4 (crédito)
const co = await one(recep, `update public.reservations set status='finalizada' where id=$1 returning status, check_out, checked_out_at`, [res1.id]);
check("check-out com crédito do hóspede é permitido", co.status === "finalizada" && co.checked_out_at !== null);
check(
  "saída ajustada para amanhã (mínimo 1 diária)",
  (await db.query(`select to_char(check_out,'YYYY-MM-DD') d from public.reservations where id=$1`, [res1.id])).rows[0].d === amanha,
);
check("quarto vai para limpeza após o check-out", (await housekeeping("101")) === "sujo");
await expectError(
  "reserva finalizada não pode ser alterada",
  () => as(recep, `update public.reservations set status='hospedado' where id=$1`, [res1.id]),
  "encerrada",
);
await expectError(
  "não lança pagamento em reserva encerrada",
  () => as(recep, `insert into public.payments (reservation_id, amount) values ($1, 10)`, [res1.id]),
  "reservas ativas",
);

// Check-out com saldo devedor é bloqueado
await as(camareira, `update public.rooms set housekeeping='limpo' where id=$1`, [r102]);
const res3 = await one(recep, `insert into public.reservations (guest_id, room_id, check_in, check_out) values ($1, $2, $3, $4) returning id`, [guest2, r102, hoje, amanha]);
await as(recep, `update public.reservations set status='hospedado' where id=$1`, [res3.id]);
await expectError(
  "check-out com saldo em aberto é bloqueado",
  () => as(recep, `update public.reservations set status='finalizada' where id=$1`, [res3.id]),
  "saldo em aberto de R$ 220,00",
);
await as(recep, `insert into public.payments (reservation_id, amount, method) values ($1, 220, 'cartao_credito')`, [res3.id]);
await as(recep, `update public.reservations set status='finalizada' where id=$1`, [res3.id]);
check("check-out liberado depois do pagamento", (await statusOf(res3.id)) === "finalizada");

console.log("\nTroca de quarto, cancelamento e não comparecimento");
const r201 = await roomId("201");
const r202 = await roomId("202");
const res4 = await one(recep, `insert into public.reservations (guest_id, room_id, check_in, check_out) values ($1, $2, $3, $4) returning id`, [guest, r201, hoje, d2]);
await as(recep, `update public.reservations set status='hospedado' where id=$1`, [res4.id]);
const moved = await one(recep, `update public.reservations set room_id=$1 where id=$2 returning room_id`, [r202, res4.id]);
check("troca de quarto com hóspede na casa", moved.room_id === r202);
check("quarto anterior vai para limpeza", (await housekeeping("201")) === "sujo");

await expectError(
  "não comparecimento só a partir da data de entrada",
  () => as(recep, `update public.reservations set status='no_show' where id=$1`, [back.id]),
  "a partir da data de entrada",
);
const canc = await one(recep, `update public.reservations set status='cancelada' where id=$1 returning cancelled_at`, [back.id]);
check("cancelamento registra a data", canc.cancelled_at !== null);
const reuse = await one(recep, `insert into public.reservations (guest_id, room_id, check_in, check_out) values ($1, $2, $3, $4) returning id`, [guest2, r101, d3, d5]);
check("reserva cancelada libera o período", Boolean(reuse.id));
await expectError(
  "hospedado não pode ser cancelado (faça o check-out)",
  () => as(recep, `update public.reservations set status='cancelada' where id=$1`, [res4.id]),
  "não permitida",
);

console.log("\nAdministração");
await expectError(
  "recepção não altera preço de produto",
  () => as(recep, `insert into public.products (name, price) values ('Vinho', 90)`),
);
const upd = await as(recep, `update public.products set price=1 where id=$1 returning id`, [agua]);
check("recepção não muda preço (sem efeito)", upd.rows.length === 0);
await as(admin, `update public.products set price=7 where id=$1`, [agua]);
check(
  "mudar preço não altera consumo já lançado",
  Number((await db.query(`select total from public.charges where product_id=$1 order by id limit 1`, [agua])).rows[0].total) === 12,
);
const st = await as(recep, `update public.settings set property_name='Hotel X' returning id`);
check("recepção não altera configurações", st.rows.length === 0);
await as(admin, `update public.settings set property_name='Pousada Sol', property_kind='pousada'`);
check(
  "admin altera configurações",
  (await db.query(`select property_name from public.settings`)).rows[0].property_name === "Pousada Sol",
);
await as(admin, `insert into public.rooms (number, room_type_id) values ('401', 2)`);
check("admin cria quarto", (await db.query(`select 1 from public.rooms where number='401'`)).rows.length === 1);

await expectError(
  "função interna de saldo não é chamável pela API",
  () => as(recep, `select public.reservation_balance(1, current_date, current_date + 1, 100)`),
  "permission denied",
);

console.log(`\n${passed} testes ok, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
