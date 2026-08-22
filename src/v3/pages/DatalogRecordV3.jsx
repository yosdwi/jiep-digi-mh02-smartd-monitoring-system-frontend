import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Popover, ScrollArea, Stack, Table, Text } from '@mantine/core';
import useUserStore from '../../stores/userStore';
import useHistoryStore from '../state/historyStore';
import ContextBar from '../app/ContextBar';
import { formatCell, isNumericType, searchDatalog } from '../services/datalogApi';
import {
  Button, Checkbox, Chip, Divider, Empty, Input, Skeleton, StatusNote,
} from '../foundation/ui';
import { color as C, layout, space, text } from '../foundation/tokens';

// Datalog Record: raw rows, one per sample.
//
// This is a polish pass, not a redesign. The V1 page works and its behaviour is
// what people expect; what it lacked was the V3 shell — the shared context bar,
// the token type scale, and loading states that say which of several waits is
// happening. The query contract is untouched, so the server is unchanged.
//
// It shares ContextBar with the other historical pages on purpose: district,
// range and unit selection carry across when someone moves from a trace to the
// rows behind it, which is the actual reason they open this page.

const PAGE_SIZES = [50, 100, 250, 500];

export default function DatalogRecordV3() {
  const profileDistrict = useUserStore((s) => s.profile?.distrik);
  const context = useHistoryStore((s) => s.context);
  const district = context.district || profileDistrict || (import.meta.env.DEV ? 'BRCB' : '');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [hidden, setHidden] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const abortRef = useRef(null);

  const canRun = Boolean(district) && context.unitNos.length > 0;

  const run = useCallback(async (nextPage = page) => {
    if (!canRun) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await searchDatalog({
        district,
        unitNos: context.unitNos,
        startDateTime: context.startDateTime,
        endDateTime: context.endDateTime,
        page: nextPage,
        pageSize,
      }, controller.signal);
      setData(result);
      setPage(nextPage);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [canRun, district, context.unitNos, context.startDateTime, context.endDateTime, pageSize, page]);

  // Page size is a property of the query, so changing it re-runs from page 1
  // rather than leaving the operator on a page number that no longer exists.
  useEffect(() => {
    if (data) run(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const columns = useMemo(
    () => (data?.columns || []).filter((c) => !hidden.has(c.key)),
    [data, hidden],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.rows || [];
    // Client-side narrowing of the page already fetched. It is explicitly not a
    // server filter: the API has one, and conflating "find it on this page" with
    // "re-query the range" would make a cheap action silently expensive.
    return (data?.rows || []).filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [data, search]);

  const totalPages = data?.totalRows && data?.pageSize
    ? Math.max(1, Math.ceil(data.totalRows / data.pageSize))
    : 1;

  return (
    <>
      <ContextBar />

      <div style={{
        height: layout.dockHeaderHeight, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: space[2],
        padding: `0 ${space[4]}px`,
        background: C.white, borderBottom: `1px solid ${C.line}`,
      }}>
        <Button variant="primary" size="sm" disabled={!canRun || loading} onClick={() => run(1)}>
          {loading ? 'Memuat…' : 'Muat data'}
        </Button>

        <Input
          placeholder="Cari di halaman ini…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
        />

        <ColumnPicker
          columns={data?.columns || []}
          hidden={hidden}
          onToggle={(key) => setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
          })}
          onReset={() => setHidden(new Set())}
        />

        <div style={{ flex: 1 }} />

        {data ? (
          <Group gap={space[2]} wrap="nowrap">
            <Text className="tnum" style={{ ...text.sm, color: C.g5 }}>
              {data.totalRows.toLocaleString('id-ID')} baris
            </Text>
            {search && rows.length !== (data.rows?.length || 0) ? (
              <Chip tone="sel">{rows.length} cocok</Chip>
            ) : null}
          </Group>
        ) : null}
      </div>

      {(data?.warnings || []).length > 0 ? (
        <div style={{ padding: `${space[2]}px ${space[4]}px`, background: C.white, borderBottom: `1px solid ${C.line}` }}>
          <Group gap={space[2]}>
            {data.warnings.map((w) => <Chip key={w} tone="warn">{w}</Chip>)}
          </Group>
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 0, background: C.white, display: 'flex', flexDirection: 'column' }}>
        <TableBody
          loading={loading}
          error={error}
          data={data}
          rows={rows}
          columns={columns}
          canRun={canRun}
          onRetry={() => run(page)}
        />
      </div>

      {data && !error ? (
        <footer style={{
          height: layout.dockHeaderHeight, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: space[3],
          padding: `0 ${space[4]}px`,
          background: C.white, borderTop: `1px solid ${C.line}`,
        }}>
          <Text style={{ ...text.sm, color: C.g5 }}>Baris per halaman</Text>
          <Group gap={4} wrap="nowrap">
            {PAGE_SIZES.map((size) => (
              <Button
                key={size}
                size="sm"
                active={pageSize === size}
                onClick={() => setPageSize(size)}
              >
                {size}
              </Button>
            ))}
          </Group>

          <div style={{ flex: 1 }} />

          <Button size="sm" disabled={page <= 1 || loading} onClick={() => run(page - 1)}>◂ Sebelumnya</Button>
          <Text className="tnum" style={{ ...text.sm, color: C.g6 }}>
            {page} / {totalPages}
          </Text>
          <Button size="sm" disabled={page >= totalPages || loading} onClick={() => run(page + 1)}>Berikutnya ▸</Button>
        </footer>
      ) : null}
    </>
  );
}

/**
 * One body, five states. They are separated because they need different things
 * from the operator: a first visit needs instructions, an in-flight refresh
 * needs the old rows left alone, and an error needs a way back.
 */
function TableBody({ loading, error, data, rows, columns, canRun, onRetry }) {
  if (error) {
    return <StatusNote tone="error" title="Gagal memuat datalog" hint={error} action="Coba lagi" onAction={onRetry} />;
  }

  if (!data && !loading) {
    return (
      <Empty
        title={canRun ? 'Belum ada data dimuat' : 'Pilih unit dan rentang waktu dulu'}
        hint={canRun
          ? 'Tekan "Muat data" untuk mengambil baris mentah pada konteks ini.'
          : 'Datalog membaca konteks yang sama dengan halaman historis lain — atur di bar atas.'}
      />
    );
  }

  // First load has no shape to preserve, so it gets skeleton rows sized like the
  // table that replaces them.
  if (loading && !data) {
    return (
      <Stack gap={0} p={space[4]}>
        <Skeleton lines={12} height={28} gap={4} />
      </Stack>
    );
  }

  if (data && rows.length === 0) {
    return (
      <StatusNote
        tone="none"
        title="Tidak ada baris"
        hint="Rentang dan unit ini tidak menghasilkan data. Coba periksa ketersediaan di pemilih unit."
      />
    );
  }

  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
      {/* A refresh keeps the current rows on screen and dims them instead of
          blanking the table — the operator can still read what they had while
          the next page arrives. */}
      <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 120ms' }}>
        <Table
          striped
          highlightOnHover
          stickyHeader
          horizontalSpacing={space[3]}
          verticalSpacing={6}
          style={{ ...text.sm }}
        >
          <Table.Thead style={{ background: C.g0 }}>
            <Table.Tr>
              {columns.map((col) => (
                <Table.Th
                  key={col.key}
                  style={{
                    ...text.label, color: C.g5, whiteSpace: 'nowrap',
                    textAlign: isNumericType(col.type) ? 'right' : 'left',
                  }}
                >
                  {col.label}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {rows.map((row, index) => (
              <Table.Tr key={`${row.timestamp_iso ?? ''}-${row.deviceid ?? ''}-${index}`}>
                {columns.map((col) => (
                  <Table.Td
                    key={col.key}
                    className={isNumericType(col.type) ? 'tnum' : undefined}
                    style={{
                      whiteSpace: 'nowrap',
                      textAlign: isNumericType(col.type) ? 'right' : 'left',
                      color: row[col.key] === null || row[col.key] === undefined ? C.g4 : C.ink,
                    }}
                  >
                    {formatCell(row[col.key], col.type)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </ScrollArea>
  );
}

/** Column visibility. `fixed` columns are the row's identity and cannot go. */
function ColumnPicker({ columns, hidden, onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  const visible = columns.length - hidden.size;

  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="bottom-start"
      width={280}
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Button size="sm" active={open} disabled={columns.length === 0} onClick={() => setOpen((o) => !o)}>
          <span style={{ color: C.g5 }}>Kolom</span>
          <span style={{ fontWeight: 600 }}>{columns.length ? `${visible}/${columns.length}` : '—'}</span>
          <span style={{ color: C.g4 }}>▾</span>
        </Button>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Group justify="space-between" align="center" p={space[3]} wrap="nowrap">
          <Text style={{ ...text.sm, color: C.g5 }}>{visible} kolom tampil</Text>
          {hidden.size > 0 ? <Button size="sm" variant="ghost" onClick={onReset}>Tampilkan semua</Button> : null}
        </Group>

        <Divider />

        <div style={{ maxHeight: 360, overflowY: 'auto', padding: space[2] }}>
          {columns.map((col) => (
            <div key={col.key} style={{ padding: `4px ${space[2]}px` }}>
              <Checkbox
                checked={!hidden.has(col.key)}
                onChange={() => !col.fixed && onToggle(col.key)}
                label={col.fixed ? `${col.label} (tetap)` : col.label}
              />
            </div>
          ))}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
