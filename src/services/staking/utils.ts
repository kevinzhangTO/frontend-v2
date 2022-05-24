import BigNumber from 'bignumber.js';
import { formatUnits, getAddress } from 'ethers/lib/utils';

import { bnum } from '@/lib/utils';
import { TokenInfoMap } from '@/types/TokenList';

import { RewardTokenData } from '../balancer/contracts/contracts/liquidity-gauge';
import { Pool, PoolAPRs } from '../balancer/subgraph/types';
import { TokenPrices } from '../coingecko/api/price.service';

const MIN_BOOST = 1;
const MAX_BOOST = 2.5;

export function calculateWeeklyReward(
  workingBalance = 0.4,
  workingSupply: BigNumber,
  balPayableToGauge: BigNumber
) {
  const shareForOneBpt = bnum(workingBalance).div(
    workingSupply.plus(workingBalance)
  );
  const weeklyReward = shareForOneBpt.times(balPayableToGauge);
  return weeklyReward;
}

export function calculateTokenPayableToGauge(
  inflationRate: BigNumber,
  gaugeRelativeWeight: BigNumber
) {
  return bnum(inflationRate)
    .times(7)
    .times(86400)
    .times(gaugeRelativeWeight);
}

export function calculateRewardTokenAprs({
  boost,
  prices,
  rewardTokensMeta,
  tokens,
  totalSupply,
  bptPrice
}: {
  rewardTokensMeta: Record<string, RewardTokenData>;
  prices: TokenPrices;
  tokens: TokenInfoMap;
  boost: string;
  totalSupply: BigNumber;
  bptPrice: BigNumber;
}) {
  if (!rewardTokensMeta) return {};
  return Object.fromEntries(
    Object.keys(rewardTokensMeta).map(rewardTokenAddress => {
      const data = rewardTokensMeta[rewardTokenAddress];
      const inflationRate = formatUnits(
        data.rate,
        tokens[getAddress(rewardTokenAddress)]?.decimals || 18
      );
      // for reward tokens, there is no relative weight
      // all tokens go to the gauge depositors
      const tokenPayable = calculateTokenPayableToGauge(
        bnum(inflationRate),
        bnum(1)
      );
      // for reward tokens we need to use the raw balance (1BPT = 1)
      const weeklyReward = calculateWeeklyReward(1, totalSupply, tokenPayable);
      const yearlyReward = weeklyReward
        .times(boost)
        .times(52)
        .times(prices[rewardTokenAddress].usd);
      const apr = yearlyReward.div(bptPrice);
      return [rewardTokenAddress, apr.toString()];
    })
  );
}

export function calculateGaugeApr({
  gaugeAddress,
  inflationRate,
  balPrice,
  bptPrice,
  workingSupplies,
  relativeWeights,
  boost = '1'
}: {
  gaugeAddress: string;
  inflationRate: string;
  balPrice: string;
  bptPrice: string;
  boost: string;
  totalSupply: BigNumber;
  workingSupplies: Record<string, string>;
  relativeWeights: Record<string, string>;
}) {
  const workingSupply = bnum((workingSupplies || {})[gaugeAddress]) || '0';
  const relativeWeight = bnum((relativeWeights || {})[gaugeAddress]) || '0';
  const balPayable = calculateTokenPayableToGauge(
    bnum(inflationRate),
    relativeWeight
  );
  // 0.4 is the working balance for 1 BPT
  const weeklyReward = calculateWeeklyReward(0.4, workingSupply, balPayable);
  const yearlyReward = weeklyReward
    .times(boost)
    .times(52)
    .times(balPrice);

  // bal apr
  const apr = yearlyReward.div(bptPrice).toString();

  return apr;
}

export function getAprRange(apr: string) {
  const min = bnum(apr).times(MIN_BOOST);
  const max = bnum(apr).times(MAX_BOOST);
  return {
    min: min.toString(),
    max: max.toString()
  };
}

/**
 * @summary A pool has staking rewards if there either a BAL
 * emission or if there is a rewards emission
 */
export function hasStakingRewards(pool: Pool | undefined) {
  if (!pool || !pool?.apr?.staking) return false;
  return (
    bnum(pool.apr.staking?.bal?.min || 0).gt(0) ||
    bnum(pool.apr.staking?.rewards || 0).gt(0)
  );
}

/**
 * @summary Checks if a pool has BAL emissions
 */
export function hasBalEmissions(pool?: Pool) {
  if (!pool) return false;
  return bnum(pool?.apr?.staking?.bal?.min || 0).gt(0);
}

/**
 * @summary Returns the BAL emission adjusted by a users boost PLUS
 * the rewards token APR
 */
export function usersBoostedAPR(aprs: PoolAPRs, boost: string) {
  if (!aprs.staking?.bal.min) return aprs?.total?.base || '0';

  const boostedAPR = bnum(aprs.staking.bal.min).times(boost);
  return boostedAPR.plus(aprs.total.base).toString();
}
