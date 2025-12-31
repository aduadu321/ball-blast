// AdMob Integration using @capacitor-community/admob

class AdManager {
    constructor() {
        this.initialized = false;
        this.interstitialReady = false;
        this.rewardedReady = false;
        this.gamesPlayed = 0;
        this.gamesUntilAd = 3;

        // Test IDs - Replace with your real IDs before publishing
        this.config = {
            interstitialId: 'ca-app-pub-3940256099942544/1033173712',
            rewardedId: 'ca-app-pub-3940256099942544/5224354917',
            bannerId: 'ca-app-pub-3940256099942544/6300978111'
        };

        this.init();
    }

    async init() {
        if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) {
            console.log('AdManager: Running in browser - ads disabled');
            return;
        }

        try {
            const { AdMob } = Capacitor.Plugins;
            if (!AdMob) {
                console.log('AdMob plugin not available');
                return;
            }

            await AdMob.initialize({
                requestTrackingAuthorization: true,
                initializeForTesting: true
            });

            this.AdMob = AdMob;
            this.initialized = true;
            console.log('AdMob initialized');

            this.setupListeners();
            this.loadInterstitial();
            this.loadRewarded();
            this.showBanner();

        } catch (error) {
            console.error('AdMob init error:', error);
        }
    }

    setupListeners() {
        if (!this.AdMob) return;

        this.AdMob.addListener('interstitialAdLoaded', () => {
            this.interstitialReady = true;
        });

        this.AdMob.addListener('interstitialAdFailedToLoad', () => {
            this.interstitialReady = false;
            setTimeout(() => this.loadInterstitial(), 30000);
        });

        this.AdMob.addListener('interstitialAdDismissed', () => {
            this.interstitialReady = false;
            this.loadInterstitial();
        });

        this.AdMob.addListener('rewardedAdLoaded', () => {
            this.rewardedReady = true;
        });

        this.AdMob.addListener('rewardedAdFailedToLoad', () => {
            this.rewardedReady = false;
            setTimeout(() => this.loadRewarded(), 30000);
        });

        this.AdMob.addListener('rewardedAdDismissed', () => {
            this.rewardedReady = false;
            this.loadRewarded();
        });
    }

    async showBanner() {
        if (!this.initialized || !this.AdMob) return;

        try {
            await this.AdMob.showBanner({
                adId: this.config.bannerId,
                adSize: 'ADAPTIVE_BANNER',
                position: 'BOTTOM_CENTER',
                margin: 0
            });
        } catch (error) {
            console.error('Banner error:', error);
        }
    }

    async hideBanner() {
        if (!this.initialized || !this.AdMob) return;
        try {
            await this.AdMob.hideBanner();
        } catch (error) {}
    }

    async loadInterstitial() {
        if (!this.initialized || !this.AdMob) return;

        try {
            await this.AdMob.prepareInterstitial({
                adId: this.config.interstitialId
            });
        } catch (error) {
            console.error('Load interstitial error:', error);
        }
    }

    async showInterstitial() {
        if (!this.initialized || !this.AdMob || !this.interstitialReady) {
            return false;
        }

        try {
            await this.AdMob.showInterstitial();
            return true;
        } catch (error) {
            console.error('Show interstitial error:', error);
            return false;
        }
    }

    async loadRewarded() {
        if (!this.initialized || !this.AdMob) return;

        try {
            await this.AdMob.prepareRewardVideoAd({
                adId: this.config.rewardedId
            });
        } catch (error) {
            console.error('Load rewarded error:', error);
        }
    }

    async showRewarded(onReward) {
        if (!this.initialized || !this.AdMob) {
            console.log('Ads not available - granting reward for testing');
            if (onReward) onReward();
            return true;
        }

        if (!this.rewardedReady) {
            console.log('Rewarded not ready');
            return false;
        }

        try {
            const listener = this.AdMob.addListener('rewardedAdRewarded', () => {
                if (onReward) onReward();
                listener.remove();
            });

            await this.AdMob.showRewardVideoAd();
            return true;
        } catch (error) {
            console.error('Show rewarded error:', error);
            return false;
        }
    }

    onGameOver() {
        this.gamesPlayed++;
        if (this.gamesPlayed >= this.gamesUntilAd) {
            this.showInterstitial();
            this.gamesPlayed = 0;
        }
    }

    isRewardedReady() {
        return this.rewardedReady || !this.initialized;
    }
}

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.AdManager = new AdManager();
    }, 500);
});
