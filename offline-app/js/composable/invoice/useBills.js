// composable/useBills.js
(function (global) {
  'use strict';

  function useBills(notify, audit, reloadInventory) {
    const { ref, computed } = Vue;

    const bills = ref([]);
    const loading = ref(false);
    const selectedType = ref('ALL');
    const searchQuery = ref('');

    const loadBills = async () => {
      loading.value = true;
      try {
        const res = await global.WebSqlService.executeSql(
          'SELECT * FROM bills ORDER BY id DESC'
        );
        bills.value = Array.isArray(res?.rows) ? res.rows : [];
      } catch (err) {
        console.error('Failed to load bills:', err);
        if (notify) notify('Failed to load vouchers', 'error');
      } finally {
        loading.value = false;
      }
    };

    const getBillItems = async (billId) => {
      try {
        const res = await global.WebSqlService.executeSql(
          'SELECT * FROM bill_items WHERE billId = ? ORDER BY id ASC',
          [Number(billId)]
        );
        return Array.isArray(res?.rows) ? res.rows : [];
      } catch (err) {
        console.error('Error fetching bill items:', err);
        return [];
      }
    };

    const getNextVoucherNo = (btype) => {
      const year = new Date().getFullYear();
      let prefix = 'INV';
      if (btype === 'PURCHASE') prefix = 'PUR';
      if (btype === 'CREDIT_NOTE') prefix = 'CN';
      if (btype === 'DEBIT_NOTE') prefix = 'DN';
      if (btype === 'DELIVERY_NOTE') prefix = 'DC';
      if (btype === 'PROFORMA') prefix = 'PRO';

      const existingMatching = bills.value.filter((b) => b.btype === btype);
      let maxNum = 0;
      existingMatching.forEach((b) => {
        if (b.bno) {
          const m = b.bno.match(/-(\d+)$/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
          }
        }
      });
      const nextNum = maxNum + 1;
      return `${prefix}-${year}-${String(nextNum).padStart(3, '0')}`;
    };

    const createBill = async (billData, itemsData = []) => {
      if (!itemsData.length) {
        if (notify) notify('Please add at least one line item', 'warning');
        return false;
      }

      const now = new Date().toISOString();
      const bno = billData.bno || getNextVoucherNo(billData.btype);

      try {
        // 1. Insert Bill Header (all fields including firm, consignee, and gross)
        const billRes = await global.WebSqlService.executeSql(
          `INSERT INTO bills (
            bno, bdate, btype, partyId, partyName, partyGstin, partyAddress, partyState, partyStateCode,
            firmGstin, firmState, firmStateCode,
            grossTotal, taxableTotal, cgst, sgst, igst, roundOff, netTotal,
            reverseCharge, supplierBillNo, orderNo, vehicleNo, dispatchThrough, narration,
            refBillId, refBillNo, status,
            consigneeName, consigneeGstin, consigneeAddress, consigneeState, consigneePin,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bno,
            billData.bdate || now.split('T')[0],
            billData.btype,
            Number(billData.partyId) || 0,
            billData.partyName || 'Cash Party',
            billData.partyGstin || 'UNREGISTERED',
            billData.partyAddress || '',
            billData.partyState || '',
            billData.partyStateCode || '27',
            billData.firmGstin || '',
            billData.firmState || '',
            billData.firmStateCode || '',
            Number(billData.grossTotal) || 0,
            Number(billData.taxableTotal) || 0,
            Number(billData.cgst) || 0,
            Number(billData.sgst) || 0,
            Number(billData.igst) || 0,
            Number(billData.roundOff) || 0,
            Number(billData.netTotal) || 0,
            billData.reverseCharge ? 1 : 0,
            billData.supplierBillNo || '',
            billData.orderNo || '',
            billData.vehicleNo || '',
            billData.dispatchThrough || '',
            billData.narration || '',
            Number(billData.refBillId) || 0,
            billData.refBillNo || '',
            'ACTIVE',
            billData.consigneeName || '',
            billData.consigneeGstin || '',
            billData.consigneeAddress || '',
            billData.consigneeState || '',
            billData.consigneePin || '',
            now,
            now
          ]
        );

        const newBillId = billRes.insertId;

        // 2. Insert Line Items & Synchronize Stock
        const isInterState = (Number(billData.igst) || 0) > 0;
        for (const it of itemsData) {
          const lineQty = Number(it.qty) || 0;
          const lineRate = Number(it.rate) || 0;
          const lineDisc = Number(it.disc) || 0;
          const lineGrate = Number(it.grate) || 18;
          const lineGross = lineQty * lineRate;
          const lineDiscAmt = lineGross * (lineDisc / 100);
          const lineTaxable = Math.round((lineGross - lineDiscAmt) * 100) / 100;

          let lineCgst = 0, lineSgst = 0, lineIgst = 0;
          if (isInterState) {
            lineIgst = Math.round((lineTaxable * (lineGrate / 100)) * 100) / 100;
          } else {
            lineCgst = Math.round((lineTaxable * (lineGrate / 200)) * 100) / 100;
            lineSgst = Math.round((lineTaxable * (lineGrate / 200)) * 100) / 100;
          }
          const lineTotal = Math.round((lineTaxable + lineCgst + lineSgst + lineIgst) * 100) / 100;

          await global.WebSqlService.executeSql(
            `INSERT INTO bill_items (
              billId, stockId, item, hsn, qty, uom, rate, disc, taxable, grate, cgst, sgst, igst, total, batch, itemType, narration
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newBillId,
              Number(it.stockId) || 0,
              it.item,
              it.hsn || '',
              lineQty,
              it.uom || 'PCS',
              lineRate,
              lineDisc,
              lineTaxable,
              lineGrate,
              lineCgst,
              lineSgst,
              lineIgst,
              lineTotal,
              it.batch || '',
              it.itemType || 'GOODS',
              it.narration || ''
            ]
          );

          // Update Stock Quantity & Post Movement
          if (it.stockId) {
            const stockRecordRes = await global.WebSqlService.executeSql('SELECT * FROM stocks WHERE id = ?', [it.stockId]);
            const currentStock = stockRecordRes.rows && stockRecordRes.rows[0];
            const oldQty = currentStock ? Number(currentStock.qty) : 0;

            let stockDelta = 0;
            // Outward types (reduce inventory)
            if (billData.btype === 'SALES' || billData.btype === 'DEBIT_NOTE' || billData.btype === 'DELIVERY_NOTE') {
              stockDelta = -lineQty;
            }
            // Inward types (increase inventory)
            else if (billData.btype === 'PURCHASE' || billData.btype === 'CREDIT_NOTE') {
              stockDelta = lineQty;
            }

            if (stockDelta !== 0) {
              const newQty = Math.max(0, oldQty + stockDelta);
              await global.WebSqlService.executeSql(
                'UPDATE stocks SET qty = ?, updated_at = ? WHERE id = ?',
                [newQty, now, it.stockId]
              );

              // Post to Stock Register
              await global.WebSqlService.executeSql(
                `INSERT INTO stock_reg (type, bno, bdate, stock_id, item, qty, qtyh, rate, partyName, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [billData.btype, bno, billData.bdate, it.stockId, it.item, stockDelta, newQty, lineRate, billData.partyName, now]
              );
            }
          }
        }

        // 3. Post to Centralized Double-Entry General Ledger
        try {
          if (global.unifiedPostingService && ['SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(billData.btype)) {
            const partyName = billData.partyName || 'Cash Party';
            const partyId = Number(billData.partyId) || null;
            const netTotal = Number(billData.netTotal) || 0;
            const taxableTotal = Number(billData.taxableTotal) || 0;
            const cgst = Number(billData.cgst) || 0;
            const sgst = Number(billData.sgst) || 0;
            const igst = Number(billData.igst) || 0;
            const roundOff = Number(billData.roundOff) || 0;
            const dateStr = billData.bdate || now.split('T')[0];
            const legs = [];

            if (billData.btype === 'SALES') {
              legs.push({ accountHead: partyName, accountType: 'SUNDRY_DEBTORS', partyId, debitAmount: netTotal, creditAmount: 0, narration: `Sales Invoice: ${bno}` });
              legs.push({ accountHead: 'Sales', accountType: 'INCOME', debitAmount: 0, creditAmount: taxableTotal, narration: `Sales of goods - ${bno}` });
              if (cgst > 0) legs.push({ accountHead: 'CGST Payable', accountType: 'LIABILITY', debitAmount: 0, creditAmount: cgst });
              if (sgst > 0) legs.push({ accountHead: 'SGST Payable', accountType: 'LIABILITY', debitAmount: 0, creditAmount: sgst });
              if (igst > 0) legs.push({ accountHead: 'IGST Payable', accountType: 'LIABILITY', debitAmount: 0, creditAmount: igst });
              if (roundOff > 0) legs.push({ accountHead: 'Round Off', accountType: 'GENERAL', debitAmount: 0, creditAmount: roundOff });
              else if (roundOff < 0) legs.push({ accountHead: 'Round Off', accountType: 'GENERAL', debitAmount: Math.abs(roundOff), creditAmount: 0 });
            } else if (billData.btype === 'PURCHASE') {
              legs.push({ accountHead: partyName, accountType: 'SUNDRY_CREDITORS', partyId, debitAmount: 0, creditAmount: netTotal, narration: `Purchase Bill: ${bno}` });
              legs.push({ accountHead: 'Purchases', accountType: 'EXPENSE', debitAmount: taxableTotal, creditAmount: 0, narration: `Procurement - ${bno}` });
              if (cgst > 0) legs.push({ accountHead: 'CGST Input Credit', accountType: 'ASSET', debitAmount: cgst, creditAmount: 0 });
              if (sgst > 0) legs.push({ accountHead: 'SGST Input Credit', accountType: 'ASSET', debitAmount: sgst, creditAmount: 0 });
              if (igst > 0) legs.push({ accountHead: 'IGST Input Credit', accountType: 'ASSET', debitAmount: igst, creditAmount: 0 });
              if (roundOff < 0) legs.push({ accountHead: 'Round Off', accountType: 'GENERAL', debitAmount: 0, creditAmount: Math.abs(roundOff) });
              else if (roundOff > 0) legs.push({ accountHead: 'Round Off', accountType: 'GENERAL', debitAmount: roundOff, creditAmount: 0 });
            } else if (billData.btype === 'CREDIT_NOTE') {
              legs.push({ accountHead: partyName, accountType: 'SUNDRY_DEBTORS', partyId, debitAmount: 0, creditAmount: netTotal, narration: `Credit Note: ${bno}` });
              legs.push({ accountHead: 'Sales', accountType: 'INCOME', debitAmount: taxableTotal, creditAmount: 0, narration: `Sales return - ${bno}` });
              if (cgst > 0) legs.push({ accountHead: 'CGST Payable', accountType: 'LIABILITY', debitAmount: cgst, creditAmount: 0 });
              if (sgst > 0) legs.push({ accountHead: 'SGST Payable', accountType: 'LIABILITY', debitAmount: sgst, creditAmount: 0 });
              if (igst > 0) legs.push({ accountHead: 'IGST Payable', accountType: 'LIABILITY', debitAmount: igst, creditAmount: 0 });
              if (roundOff < 0) legs.push({ accountHead: 'Round Off', accountType: 'GENERAL', debitAmount: 0, creditAmount: Math.abs(roundOff) });
              else if (roundOff > 0) legs.push({ accountHead: 'Round Off', accountType: 'GENERAL', debitAmount: roundOff, creditAmount: 0 });
            } else if (billData.btype === 'DEBIT_NOTE') {
              legs.push({ accountHead: partyName, accountType: 'SUNDRY_CREDITORS', partyId, debitAmount: netTotal, creditAmount: 0, narration: `Debit Note: ${bno}` });
              legs.push({ accountHead: 'Purchases', accountType: 'EXPENSE', debitAmount: 0, creditAmount: taxableTotal, narration: `Purchase return - ${bno}` });
              if (cgst > 0) legs.push({ accountHead: 'CGST Input Credit', accountType: 'ASSET', debitAmount: 0, creditAmount: cgst });
              if (sgst > 0) legs.push({ accountHead: 'SGST Input Credit', accountType: 'ASSET', debitAmount: 0, creditAmount: sgst });
              if (igst > 0) legs.push({ accountHead: 'IGST Input Credit', accountType: 'ASSET', debitAmount: 0, creditAmount: igst });
              if (roundOff > 0) legs.push({ accountHead: 'Round Off', accountType: 'GENERAL', debitAmount: 0, creditAmount: roundOff });
              else if (roundOff < 0) legs.push({ accountHead: 'Round Off', accountType: 'GENERAL', debitAmount: Math.abs(roundOff), creditAmount: 0 });
            }

            if (legs.length > 0) {
              await global.unifiedPostingService.postVoucher({
                voucherType: billData.btype,
                transactionDate: dateStr,
                narration: `${billData.btype} #${bno} - ${partyName}`,
                legs,
                createdBy: 'Admin',
                refType: 'BILL',
                refId: newBillId,
                externalVoucherGroupId: `BILL-${newBillId}`,
                externalVoucherNo: bno
              });
            }
          }
        } catch (postErr) {
          console.warn('[Ledger] Invoice GL posting notice:', postErr);
        }

        if (audit) audit('VOUCHER_CREATED', `Generated ${billData.btype} #${bno} for ${billData.partyName} (₹${billData.netTotal})`);
        if (notify) notify(`${billData.btype} #${bno} created, stocks and General Ledger updated!`, 'success');

        await loadBills();
        if (reloadInventory) await reloadInventory();
        return { success: true, id: newBillId, bno };
      } catch (err) {
        console.error('Error creating bill:', err);
        if (notify) notify('Failed to save voucher: ' + err.message, 'error');
        return false;
      }
    };

    const deleteBill = async (billId, bno) => {
      try {
        // 1. Fetch bill header to determine type for stock reversal
        const billRes = await global.WebSqlService.executeSql('SELECT * FROM bills WHERE id = ?', [billId]);
        const bill = billRes.rows && billRes.rows[0];

        // 2. Fetch bill items for stock reversal
        const itemsRes = await global.WebSqlService.executeSql('SELECT * FROM bill_items WHERE billId = ?', [billId]);
        const billItems = Array.isArray(itemsRes?.rows) ? itemsRes.rows : [];

        // 3. Reverse stock adjustments before deleting
        if (bill && billItems.length > 0) {
          const now = new Date().toISOString();
          for (const it of billItems) {
            if (it.stockId && Number(it.stockId) > 0) {
              const stockRes = await global.WebSqlService.executeSql('SELECT * FROM stocks WHERE id = ?', [it.stockId]);
              const stock = stockRes.rows && stockRes.rows[0];
              if (stock) {
                let reverseDelta = 0;
                // Reverse outward: add back stock
                if (bill.btype === 'SALES' || bill.btype === 'DEBIT_NOTE' || bill.btype === 'DELIVERY_NOTE') {
                  reverseDelta = Number(it.qty) || 0;
                }
                // Reverse inward: remove stock
                else if (bill.btype === 'PURCHASE' || bill.btype === 'CREDIT_NOTE') {
                  reverseDelta = -(Number(it.qty) || 0);
                }
                if (reverseDelta !== 0) {
                  const newQty = Math.max(0, (Number(stock.qty) || 0) + reverseDelta);
                  await global.WebSqlService.executeSql(
                    'UPDATE stocks SET qty = ?, updated_at = ? WHERE id = ?',
                    [newQty, now, it.stockId]
                  );
                }
              }
            }
          }
        }

        // 4. Reverse / remove Double-Entry General Ledger posting
        try {
          if (global.unifiedPostingService) {
            await global.unifiedPostingService.deleteVoucher(`BILL-${billId}`);
          }
        } catch (glDelErr) {
          console.warn('[Ledger] Delete bill voucher notice:', glDelErr);
        }

        // 5. Delete records
        await global.WebSqlService.executeSql('DELETE FROM bill_items WHERE billId = ?', [billId]);
        await global.WebSqlService.executeSql('DELETE FROM bills WHERE id = ?', [billId]);
        if (audit) audit('VOUCHER_DELETED', `Deleted voucher #${bno}, reversed stock and General Ledger`);
        if (notify) notify(`Voucher #${bno} deleted, stock and General Ledger updated`, 'info');
        await loadBills();
        if (reloadInventory) await reloadInventory();
        return true;
      } catch (err) {
        console.error('Error deleting bill:', err);
        if (notify) notify('Failed to delete voucher', 'error');
        return false;
      }
    };

    const filteredBills = computed(() => {
      let list = Array.isArray(bills.value) ? bills.value.filter(Boolean) : [];

      if (searchQuery.value && searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        list = list.filter((b) =>
          (b.bno && b.bno.toLowerCase().includes(q)) ||
          (b.partyName && b.partyName.toLowerCase().includes(q)) ||
          (b.partyGstin && b.partyGstin.toLowerCase().includes(q)) ||
          (b.orderNo && b.orderNo.toLowerCase().includes(q))
        );
      }

      if (selectedType.value !== 'ALL') {
        list = list.filter((b) => b.btype === selectedType.value);
      }

      return list;
    });

    const metrics = computed(() => {
      const list = Array.isArray(bills.value) ? bills.value : [];
      const salesTotal = list.filter((b) => b.btype === 'SALES').reduce((acc, b) => acc + (Number(b.netTotal) || 0), 0);
      const purchaseTotal = list.filter((b) => b.btype === 'PURCHASE').reduce((acc, b) => acc + (Number(b.netTotal) || 0), 0);
      const creditNoteCount = list.filter((b) => b.btype === 'CREDIT_NOTE').length;
      const debitNoteCount = list.filter((b) => b.btype === 'DEBIT_NOTE').length;
      const challanCount = list.filter((b) => b.btype === 'DELIVERY_NOTE').length;

      return {
        salesTotal,
        purchaseTotal,
        creditNoteCount,
        debitNoteCount,
        challanCount,
        totalVouchers: list.length
      };
    });

    return {
      bills,
      filteredBills,
      metrics,
      loading,
      selectedType,
      searchQuery,
      loadBills,
      getBillItems,
      getNextVoucherNo,
      createBill,
      deleteBill
    };
  }

  global.useBills = useBills;
})(window);
