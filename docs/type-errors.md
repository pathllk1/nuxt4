# Nuxt 3 TypeScript Error Report

> Generated: 2026-08-05
> Command: `npx nuxt typecheck`
> Exit code: 2 (type errors present)
> Total errors: ~180+ across 40+ files

---

## Error Category Summary

| Category | Error Codes | Count | Root Cause |
|----------|-------------|-------|------------|
| Mongoose Query type mismatch | TS2349, TS2353 | ~60 | `.lean()` changes return type but TS infers wrong Query type |
| ObjectId → string conversion | TS2352 | ~35 | Passing `ObjectId` where `string` is expected |
| Possibly undefined | TS18048, TS2532 | ~20 | Variables used without null/undefined checks |
| verbatimModuleSyntax import | TS1484 | 3 | Types imported with `import` instead of `import type` |
| Vue component prop mismatch | TS2345 | ~10 | `class`/`style` props passed to components that don't accept them |
| Vue color prop invalid | TS2322 | 2 | Colors `"teal"`, `"rose"` not in allowed set |
| Implicit any parameter | TS7006 | ~5 | Arrow function params lack type annotation |
| $fetch type mismatch | TS2339 | 3 | `download` property doesn't exist on `$fetch` return type |
| Unknown compiler option | TS5023 | 1 | `libReplacement` not recognized in tsconfig |
| Argument type mismatch | TS2345 | ~5 | Wrong argument types passed to Mongoose queries |
| Implicit any return | TS7022, TS7024 | 3 | Function lacks return type annotation |
| Index signature missing | TS2538 | 1 | `undefined` used as index type |

---

## Category 1: Mongoose Query Type Mismatch (TS2349, TS2353)

The most prevalent error class. When `.lean()` is called on a Mongoose query, the return type changes from `Query<Document, ...>` to `Query<any, ...>`. However, TypeScript infers the query variable as the non-lean `Query` type, which doesn't accept `lean: true` in options or certain filter properties.

### Pattern A: `findOne` with `lean()` — TS2349

**Error:** `This expression is not callable. Each member of the union type has signatures, but none of those signatures are compatible with each other.`

**Affected files (all use `findOne(...).lean()` or `find(...).lean()`):**

| File | Line | Code |
|------|------|------|
| `server/api/accounting/credit-notes.post.ts` | 71 | `findOne(...).lean()` |
| `server/api/auth/me.get.ts` | 15 | `findById(...).lean()` |
| `server/api/auth/signup.post.ts` | 50 | `findOne(...).lean()` |
| `server/api/firms/current.get.ts` | 12 | `findOne(...).lean()` |
| `server/api/firms/[firmId]/members.post.ts` | 23 | `findOne(...).lean()` |
| `server/api/firms/[firmId]/members/[userId].delete.ts` | 23 | `findOne(...).lean()` |
| `server/api/firms/[firmId]/members/[userId].put.ts` | 24 | `findOne(...).lean()` |
| `server/api/inventory/movements.post.ts` | 52 | `findOne(...).lean()` |
| `server/api/inventory/stock/[id].put.ts` | 12 | `findOne(...).lean()` |
| `server/api/master-rolls/[id].put.ts` | 42 | `findOne(...).lean()` |
| `server/api/master-rolls/[id]/activity.get.ts` | 15 | `findOne(...).lean()` |
| `server/api/master-rolls/bulk-update.put.ts` | 54 | `findOne(...).lean()` |
| `server/api/master-rolls/export/icards.get.ts` | 42 | `findOne(...).lean()` |
| `server/api/master-rolls/stats.get.ts` | 13, 17 | `findOne(...).lean()` |
| `server/api/master-rolls/unique-fields.get.ts` | 15-18 | `findOne(...).lean()` |
| `server/api/wages/bulk-slips.get.ts` | 143 | `findOne(...).lean()` |
| `server/api/wages/export.post.ts` | 19 | `findOne(...).lean()` |
| `server/api/wages/slip/[id].get.ts` | 134 | `findOne(...).lean()` |
| `server/utils/accounting/bill-number-generator.ts` | 16 | `findOne(...).lean()` |
| `server/utils/accounting/bill-shared.ts` | 7 | `findOne(...).lean()` |
| `server/utils/accounting/bill-utils.ts` | 55, 72 | `findOne(...).lean()` |
| `server/utils/security.ts` | 207, 228 | `findOne(...).lean()` |
| `server/utils/wage-authz.ts` | 19 | `findOne(...).lean()` |
| `server/utils/wages-ledger-helper.ts` | 181 | `findOne(...).lean()` |

**Root cause:** The return type of `.lean()` is not correctly inferred. The Mongoose types for the model don't include a proper `.lean()` overload, so TypeScript falls back to the generic `Query` type which doesn't accept `lean: true` in the options.

**Fix:** Add explicit type annotation or cast:
```typescript
const doc = await Model.findOne({ ... }).lean() as any;
// Or better:
const doc = await Model.findOne({ ... }).lean<Document>() as Document;
```

### Pattern B: Filter object has unknown properties — TS2353

**Error:** `Object literal may only specify known properties, and 'X' does not exist in type 'Query<...>'`

This is a consequence of Pattern A — since TypeScript thinks the query is a `Query` object (not a filter object), passing `{ firm_id: ..., status: ... }` as the filter to `findOne()` is flagged as having unknown properties.

**Affected locations:**

| File | Line | Unknown Property |
|------|------|-----------------|
| `server/api/auth/signup.post.ts` | 26 | `email` |
| `server/api/firms.get.ts` | 6 | `status` |
| `server/api/firms/[firmId]/members.get.ts` | 15 | `'firms.firm'` |
| `server/api/firms/[firmId]/members.post.ts` | 57 | `email` |
| `server/api/firms/[firmId]/members.post.ts` | 106 | `email` |
| `server/api/firms/current.get.ts` | 19 | `status` |
| `server/api/firms/settings/gst.get.ts` | 15 | `firmId` |
| `server/api/inventory/stock/sales-analysis.get.ts` | 25 | `type` |
| `server/api/inventory/stock/service-suggestions.get.ts` | 14 | `item_type` |
| `server/api/master-rolls/[id].delete.ts` | 15 | `_id` |
| `server/api/master-rolls/export.get.ts` | 17 | `_id` |
| `server/api/master-rolls/export/quality-report.get.ts` | 20 | `firm_id` |
| `server/api/wages/eligible-employees.post.ts` | 61 | `firm_id` |
| `server/api/wages/epf-esic-report.get.ts` | 38 | `firm_id` |
| `server/api/wages/history/[masterRollId]/export.get.ts` | 13 | `_id` |
| `server/utils/accounting/bill-shared.ts` | 43 | `firmId` |
| `server/utils/security.ts` | 111 | `token` |
| `server/utils/security.ts` | 146 | `refreshToken` |
| `server/utils/security.ts` | 256 | `userId` |
| `server/utils/wage-job-processor.ts` | 84 | `_id` |

**Fix:** Cast the filter object to `any` or use a typed filter:
```typescript
const doc = await Model.findOne({ _id: id, firm_id: firmId } as any).lean();
```

---

## Category 2: ObjectId → string Conversion (TS2352)

**Error:** `Conversion of type 'ObjectId' to type 'string' may be a mistake`

Mongoose `_id` fields are `ObjectId` type, but many routes use them as URL parameters which are `string`. The code passes `ObjectId` values where `string` is expected in query filters.

**Affected files:**

| File | Lines | Variable |
|------|-------|----------|
| `server/api/accounting/bills.get.ts` | 10 | ObjectId → string in query |
| `server/api/accounting/bills/[id].get.ts` | 15 | `id` param |
| `server/api/accounting/bills/[id]/cancel.post.ts` | 21, 35, 41 | `id` param |
| `server/api/accounting/bills/get-next-number.get.ts` | 10 | ObjectId |
| `server/api/accounting/credit-notes.post.ts` | 71 | ObjectId |
| `server/api/accounting/ledger.get.ts` | 10 | ObjectId |
| `server/api/accounting/ledger/account-types.get.ts` | 9 | ObjectId |
| `server/api/accounting/ledger/journal-summary.get.ts` | 7 | ObjectId |
| `server/api/accounting/ledger/trial-balance.get.ts` | 10 | ObjectId |
| `server/api/accounting/ledger/vouchers-summary.get.ts` | 7 | ObjectId |
| `server/api/accounting/proforma.post.ts` | 21 | ObjectId |
| `server/api/accounting/proforma/[id].put.ts` | 27 | `id` param |
| `server/api/accounting/proforma/[id]/convert.post.ts` | 22 | ObjectId |
| `server/api/accounting/purchases.post.ts` | 24 | ObjectId |
| `server/api/accounting/sales.post.ts` | 24 | ObjectId |
| `server/api/accounting/vouchers.post.ts` | 36 | ObjectId |
| `server/api/advances.post.ts` | 25 | ObjectId |
| `server/api/advances/balance/[masterRollId].get.ts` | 13 | ObjectId |
| `server/api/advances/balances.get.ts` | 10 | ObjectId |
| `server/api/gst/gstr1/report.get.ts` | 12, 13, 14 | ObjectId |
| `server/api/gst/gstr3b/report.get.ts` | 12, 13 | ObjectId |

**Fix:** Convert ObjectId to string explicitly:
```typescript
const id = new mongoose.Types.ObjectId(params.id).toString();
// Or use string conversion:
const id = String(params.id);
```

---

## Category 3: Possibly Undefined / Null (TS18048, TS2532)

**Error:** `Variable is possibly 'undefined'` or `Object is possibly 'undefined'`

| File | Line | Variable / Issue |
|------|------|-----------------|
| `server/api/accounting/proforma/[id]/convert.post.ts` | 96, 107, 108, 118, 137(x2), 137(x2), 137(x2), 141, 148, 151, 153, 154, 155, 156, 157, 158 | `salesInvoice` possibly undefined |
| `server/api/accounting/purchases.post.ts` | 131, 142, 153(x2), 157(x2), 164, 167 | `newBill` possibly undefined |
| `server/api/accounting/sales.post.ts` | 124, 135, 147(x2), 147(x2), 151(x2), 159, 162 | `newBill` possibly undefined |
| `server/middleware/security.global.ts` | 39 | `oldestTs` possibly undefined |
| `server/utils/crypto-hash.ts` | 49, 50 | Object possibly undefined |
| `server/utils/wages-ledger-helper.ts` | 119, 164 | Object possibly undefined |
| `server/api/wages/epf-esic-report.get.ts` | 33 | Object possibly undefined |

**Fix:** Add null checks or use optional chaining (`?.`) and nullish coalescing (`??`).

---

## Category 4: verbatimModuleSyntax Import Errors (TS1484)

**Error:** `'X' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.`

| File | Line | Import |
|------|------|--------|
| `server/utils/accounting/smart-voucher-converter.ts` | 2 | `LedgerEntryParams` |
| `server/utils/jwt.ts` | 3 | `IUser` |
| `server/utils/wage-job-processor.ts` | 2 | `IWage` |

**Fix:** Change `import { X }` to `import type { X }` in each file.

---

## Category 5: Vue Component Prop Mismatch (TS2345)

**Error:** `Argument of type '{ [x: string]: unknown; class?: ClassValue; style?: StyleValue; }' is not assignable to parameter of type '...'`

All errors are in `app/components/accounting/*.vue` and `app/components/inventory/*.vue` at line 6, column 4. The `class` and `style` props are being passed to components that don't declare them in their props definition.

| File | Missing Props |
|------|---------------|
| `app/components/accounting/CartManager.vue` | `state` (BillingState) |
| `app/components/accounting/CreateStockModal.vue` | `modelValue`, `onUpdate:modelValue`, `onSaved` |
| `app/components/accounting/EditStockModal.vue` | `modelValue`, `stock`, `onUpdate:modelValue`, `onSaved` |
| `app/components/accounting/PartyManager.vue` | `state` (BillingState), `title`, `emptySubtitle`, `onOpen-modal`, `onCreate-party`, `onLocation-change` |
| `app/components/accounting/StockModal.vue` | `modelValue`, `stocks`, `onSelect`, `onUpdate:modelValue`, `onCreate-stock`, `onEdit-stock` |
| `app/components/inventory/OtherChargesModal.vue` | `modelValue`, `otherCharges`, `onUpdate:modelValue` |
| `app/components/inventory/PartyModal.vue` | `modelValue`, `onUpdate:modelValue`, `onSaved` |

**Fix:** Either add `class` and `style` to the component's prop definitions, or use `v-bind="$attrs"` to pass them through.

---

## Category 6: Vue Color Prop Invalid (TS2322)

**File:** `app/pages/inventory/index.vue`

| Line | Value | Allowed Values |
|------|-------|---------------|
| 32 | `"teal"` | `"primary"`, `"secondary"`, `"success"`, `"info"`, `"warning"`, `"error"`, `"neutral"` |
| 41 | `"rose"` | same as above |

**Fix:** Replace with valid color names or use the hex/RGB equivalent.

---

## Category 7: Implicit `any` Parameters (TS7006)

**Error:** `Parameter 'f' implicitly has an 'any' type.`

| File | Line | Parameter |
|------|------|-----------|
| `server/api/firms/[firmId]/members.get.ts` | 19 | `f` |
| `server/api/firms/[firmId]/members.post.ts` | 24, 77 | `f` |
| `server/api/firms/[firmId]/members/[userId].delete.ts` | 24, 42 | `f` |
| `server/api/firms/[firmId]/members/[userId].put.ts` | 25, 51 | `f` |

**Fix:** Add explicit type annotation: `(f: FirmAssignment) => ...` or enable `noImplicitAny` in tsconfig.

---

## Category 8: $fetch Type Mismatch (TS2339)

**File:** `app/pages/accounting/bills.vue` (lines 400, 412, 423)

**Error:** `Property 'download' does not exist on type '{ get: ... }'`

The `$fetch` return type doesn't include a `download` method. This is likely a custom extension or the code is using an older API.

**Fix:** Use `$fetch.raw()` for binary responses or cast the return type.

---

## Category 9: Other Miscellaneous Errors

### TS5023 — Unknown compiler option `libReplacement`
- **File:** `.nuxt/tsconfig.app.json:153`
- **Fix:** Remove `libReplacement` from tsconfig or update TypeScript version.

### TS7022 / TS7024 — Implicit any return type
- **File:** `server/api/master-rolls/lookup/ifsc/[ifsc].get.ts` (lines 3, 35, 12)
- **Fix:** Add explicit return type annotations.

### TS2339 — `Property 'default' does not exist on type 'typeof import(...archiver')'`
- **File:** `server/api/wages/bulk-slips.get.ts:147`
- **Fix:** The `@types/archiver` package doesn't export `default`. Use `import archiver from 'archiver'` with `esModuleInterop` or `import * as archiver from 'archiver'`.

### TS2345 — Argument type mismatch (empty object `{}`)
- **File:** `server/api/auth/security-logs.get.ts:9`, `server/api/firms/current.get.ts:22`, `server/api/inventory/stock.get.ts:31`, `server/api/inventory/stock/valuation.get.ts:24`, `server/api/master-rolls.get.ts:39`, `server/api/master-rolls/export/icards.get.ts:41`
- **Fix:** Pass a properly typed filter object instead of `{}`.

### TS2353 — Object literal has unknown properties
- Already covered in Category 1 (Pattern B).

### TS2352 — ObjectId to string conversion
- Already covered in Category 2.

### TS2538 — `undefined` cannot be used as index type
- **File:** `server/utils/crypto-hash.ts:52`
- **Fix:** Add null check before using as index.

### TS2345 — `string | undefined` not assignable to `string`
- **File:** `server/api/gst/gstr1/report.get.ts:12,13,14`, `server/api/gst/gstr3b/report.get.ts:12,13`, `server/api/wages/eligible-employees.post.ts:11,12`, `server/api/wages/epf-esic-report.get.ts:33`
- **Fix:** Add null checks or use `String()` conversion.

### TS2322 — `string | undefined` not assignable to `string | null`
- **File:** `server/api/wages/eligible-employees.post.ts:24,27`
- **Fix:** Add `?? null` or proper null check.

### TS18048 — Variable possibly undefined
- **File:** `server/middleware/security.global.ts:39`, `server/api/accounting/proforma/[id]/convert.post.ts` (multiple), `server/api/accounting/purchases.post.ts` (multiple), `server/api/accounting/sales.post.ts` (multiple)
- **Fix:** Add null/undefined checks.

### TS2345 — `Argument of type 'string' is not assignable to parameter of type 'number'`
- **File:** `server/middleware/security.global.ts:86`
- **Fix:** Convert string to number before passing.
