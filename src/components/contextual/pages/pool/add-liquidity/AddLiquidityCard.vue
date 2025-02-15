<script setup lang="ts">
import { onMounted, watch } from 'vue';
import SwapSettingsPopover, {
  SwapSettingsContext,
} from '@/components/popovers/SwapSettingsPopover.vue';
import { configService } from '@/services/config/config.service';
import InvestFormV2 from '@/components/forms/pool_actions/InvestForm/InvestFormV2.vue';
import InvestForm from '@/components/forms/pool_actions/InvestForm/InvestForm.vue';
import useInvestPageTabs, {
  Tab,
  tabs,
} from '@/composables/pools/useInvestPageTabs';
import { useJoinPool } from '@/providers/local/join-pool.provider';
import { usePoolHelpers } from '@/composables/usePoolHelpers';
import { Pool } from '@/services/pool/types';

/**
 * TYPES
 */
type Props = {
  pool: Pool;
};

/**
 * PROPS & EMITS
 */
const props = defineProps<Props>();
const pool = toRef(props, 'pool');

/**
 * COMPOSABLES
 */
const { network } = configService;
const { activeTab, resetTabs } = useInvestPageTabs();
const { setIsSingleAssetJoin } = useJoinPool();
const { isDeepPool, isPreMintedBptPool } = usePoolHelpers(pool);

/**
 * LIFECYCLE
 */
onMounted(() => resetTabs());

/**
 * WATCHERS
 */
watch(activeTab, value => {
  setIsSingleAssetJoin(value === Tab.SingleToken);
});
</script>

<template>
  <BalCard shadow="xl" exposeOverflow noBorder>
    <template #header>
      <div class="w-full">
        <div class="text-xs leading-none text-secondary">
          {{ network.chainName }}
        </div>
        <div class="flex justify-between items-center">
          <h4>{{ $t('addLiquidity') }}</h4>
          <SwapSettingsPopover :context="SwapSettingsContext.invest" />
        </div>
        <BalTabs
          v-if="isDeepPool && isPreMintedBptPool"
          v-model="activeTab"
          :tabs="tabs"
          class="p-0 m-0 -mb-px whitespace-nowrap"
          noPad
        />
      </div>
    </template>
    <InvestFormV2 v-if="true" :pool="pool" />
    <!-- Temp support in case we need to re-enable old flow -->
    <InvestForm v-else :pool="pool" />
  </BalCard>
</template>

