import React from 'react';
import { Text, View } from 'react-native';
import type { Settlement } from '../domain/calc';
import { AmountText, Card, SectionTitle, SummaryRow } from './ui';
import { colors, fmt, priceLabel, space } from '../theme';

export type SettlementExpense = {
  key: string;
  headName: string;
  note: string;
  type: 'deduction' | 'addition';
  amount: number;
};

export type SettlementData = {
  date: string;
  time: string;
  bus?: string;
  driver?: string;
  conductor?: string;
  driverPct: number;
  conductorPct: number;
  result: Settlement;
  expenses: SettlementExpense[];
};

/** The settlement page: shares first, details below. Shared by the wizard and the preview screen. */
export default function SettlementView({ data }: { data: SettlementData }) {
  const { result, expenses } = data;
  return (
    <>
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
        <ShareCard
          title="Driver"
          name={data.driver}
          pct={data.driverPct}
          amount={result.driver}
          bg={colors.driver}
          sub="#DBE6FF"
        />
        <ShareCard
          title="Conductor"
          name={data.conductor}
          pct={data.conductorPct}
          amount={result.conductor}
          bg={colors.conductor}
          sub="#FFE3D3"
        />
      </View>

      <Card style={{ backgroundColor: colors.soft, borderColor: colors.primary }}>
        <SummaryRow label="Owner's cut" value={fmt(result.owner)} bold color={colors.primary} />
      </Card>

      <SectionTitle>Entry details</SectionTitle>
      <Card>
        <SummaryRow label="Date" value={`${data.date}  ${data.time}`} />
        <SummaryRow label="Bus" value={data.bus ?? '-'} />
        <SummaryRow label="Driver" value={data.driver ?? '-'} />
        <SummaryRow label="Conductor" value={data.conductor ?? '-'} />
      </Card>

      <SectionTitle>Tickets</SectionTitle>
      <Card>
        {result.tickets.map((t) => (
          <SummaryRow key={t.price} label={`${priceLabel(t.price)} × ${t.sold} sold (${t.returned} returned)`} value={fmt(t.amount)} />
        ))}
        <SummaryRow label="Gross collection" value={fmt(result.gross)} bold />
      </Card>

      <SectionTitle>Expenses</SectionTitle>
      <Card style={{ borderColor: colors.expense }}>
        {expenses.length === 0 && <Text style={{ color: colors.muted }}>None.</Text>}
        {expenses.map((e) => (
          <SummaryRow
            key={e.key}
            label={e.note ? `${e.headName} · ${e.note}` : e.headName}
            value={`${e.type === 'addition' ? '+' : '−'} ${fmt(e.amount)}`}
            color={colors.expense}
          />
        ))}
        <SummaryRow label="Total expenses" value={fmt(result.totalExpenses)} bold color={colors.expense} />
      </Card>

      <SectionTitle>Collection</SectionTitle>
      <Card>
        <SummaryRow label="Gross" value={fmt(result.gross)} />
        <SummaryRow label="Expenses" value={`− ${fmt(result.totalExpenses)}`} color={colors.expense} />
        <SummaryRow label="Net collection" value={fmt(result.net)} bold />
      </Card>
    </>
  );
}

function ShareCard({
  title,
  name,
  pct,
  amount,
  bg,
  sub,
}: {
  title: string;
  name?: string;
  pct: number;
  amount: number;
  bg: string;
  sub: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: 16,
        paddingVertical: space.xl,
        paddingHorizontal: space.md,
        alignItems: 'center',
        marginBottom: space.md,
      }}
    >
      <Text style={{ color: sub, fontSize: 14, fontWeight: '600' }}>{title} share</Text>
      <AmountText style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginVertical: 8, alignSelf: 'stretch', textAlign: 'center' }}>
        {fmt(amount)}
      </AmountText>
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
        {name ?? '-'}
      </Text>
      <Text style={{ color: sub, fontSize: 13, marginTop: 2 }}>{pct}% of net</Text>
    </View>
  );
}
