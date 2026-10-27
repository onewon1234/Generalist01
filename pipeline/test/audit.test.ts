import { test } from 'node:test';
import assert from 'node:assert/strict';
import { koreanScope, outletOf } from '../src/preview/audit.ts';

test('outletOf: feed names and NAVER hosts map to one outlet', () => {
  assert.equal(outletOf({ publisher: 'yna.co.kr' }), '연합뉴스');
  assert.equal(outletOf({ publisher: '연합뉴스' }), '연합뉴스');
  assert.equal(outletOf({ publisher: 'The Guardian – World' }), 'The Guardian');
  assert.equal(outletOf({ publisher: 'BBC News – Business' }), 'BBC');
});

test('koreanScope: Korean-reported foreign events vs domestic events', () => {
  assert.equal(koreanScope('민주콩고 에볼라 확진자 1만명 넘어…절반 가까이 사망'), 'foreign');
  assert.equal(koreanScope("'재정 빨간불' 벨기에도 국채 금리 급등…2011년 이래 최고"), 'foreign');
  assert.equal(koreanScope('금융위, 초고금리 불법사금융 징역 10년으로 강화'), 'domestic');
  assert.equal(koreanScope('HD현대중, 올해 임단협 마무리'), 'domestic');
});
