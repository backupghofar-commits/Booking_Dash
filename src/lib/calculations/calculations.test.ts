import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBookingTotals, convertIDRtoSAR, convertSARtoIDR } from '../../utils/currency';
import { computeArmadaTotals } from '../../utils/armadaFinance';
import { computeTrainTotals } from '../../utils/trainFinance';
import { parseMoney } from '../../utils/finance';
import { canTransition, derivePaymentStatus, roundIDR, roundSAR } from './workflow';

describe('currency conversion', () => {
  it('converts SAR to IDR with deterministic rounding', () => {
    assert.equal(convertSARtoIDR(100, 4250), 425000);
    assert.equal(roundIDR(convertSARtoIDR(12.34, 4250)), 52445);
  });
  it('converts IDR to SAR', () => {
    assert.equal(roundSAR(convertIDRtoSAR(425000, 4250)), 100);
  });
});

describe('hotel booking totals', () => {
  it('computes rooms × nights + extras', () => {
    const t = computeBookingTotals(
      [{ numberOfRooms: 1, costPerNight: 850, sellPerNight: 1100 }],
      [{ cost: 450, sell: 650 }],
      5,
      'SAR',
      4250,
      0
    );
    assert.equal(t.totalCostSAR, 4700);
    assert.equal(t.totalSellSAR, 6150);
    assert.equal(t.profitSAR, 1450);
    assert.ok(Math.abs(t.profitMarginPercent - 23.577) < 0.01);
  });
});

describe('armada totals', () => {
  it('multiplies units × cost × legs + extras', () => {
    const t = computeArmadaTotals({
      units: [
        {
          id: 'u1',
          vehicleType: 'Bus 45 Seat',
          plateNumber: 'X',
          driverName: 'A',
          driverPhone: '',
          capacity: 45,
          note: '',
        },
      ],
      costPerUnit: 1400,
      sellPerUnit: 1750,
      extras: [{ cost: 150, sell: 300 }],
      tripLegs: 1,
      inputCurrency: 'SAR',
      exchangeRate: 4680,
    });
    assert.equal(t.totalCostSAR, 1550);
    assert.equal(t.totalSellSAR, 2050);
    assert.equal(t.profitSAR, 500);
    assert.equal(t.totalCostIDR, 7254000);
  });
});

describe('train totals', () => {
  it('multiplies pax × fare × legs + extras', () => {
    const t = computeTrainTotals({
      passengers: new Array(8).fill(null).map((_, i) => ({
        id: String(i),
        fullName: 'P',
        idNumber: '',
        nationality: 'Indonesia',
        category: 'Adult',
        seatCoach: '',
        seatNumber: '',
      })),
      costPerPax: 170,
      sellPerPax: 210,
      extras: [{ cost: 80, sell: 150 }],
      tripLegs: 1,
      inputCurrency: 'SAR',
      exchangeRate: 4680,
    });
    assert.equal(t.paxCount, 8);
    assert.equal(t.totalCostSAR, 1440);
    assert.equal(t.totalSellSAR, 1830);
  });
});

describe('workflow', () => {
  it('derives payment status from remaining balance', () => {
    assert.equal(derivePaymentStatus('Unpaid', 0, 100), 'Unpaid');
    assert.equal(derivePaymentStatus('Unpaid', 40, 100), 'Partial');
    assert.equal(derivePaymentStatus('Unpaid', 100, 100), 'Paid');
    assert.equal(derivePaymentStatus('Draft', 100, 100), 'Draft');
    assert.equal(derivePaymentStatus('Cancelled', 0, 100), 'Cancelled');
  });
  it('blocks invalid transitions', () => {
    assert.equal(canTransition('Cancelled', 'Paid'), false);
    assert.equal(canTransition('Cancelled', 'Draft'), true);
    assert.equal(canTransition('Draft', 'Unpaid'), true);
    assert.equal(canTransition('Paid', 'Cancelled'), true);
    assert.equal(canTransition('Cancelled', 'Paid', true), true);
  });
});

describe('money parser', () => {
  it('parses localized strings without silent coercion of blanks', () => {
    assert.equal(parseMoney('1.234,50'), 1234.5);
    assert.equal(parseMoney('SAR 100'), 100);
    assert.equal(parseMoney(''), null);
    assert.equal(parseMoney('-'), null);
  });
});
