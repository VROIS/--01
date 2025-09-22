import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Coins, Gift, Users, Zap } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  originalPrice?: number;
  popular?: boolean;
  bonus?: number;
  description: string;
}

const creditPackages: CreditPackage[] = [
  {
    id: 'starter',
    credits: 10,
    price: 4.99,
    description: '드림샷 이미지 2개 생성'
  },
  {
    id: 'popular',
    credits: 25,
    price: 9.99,
    originalPrice: 12.47,
    popular: true,
    bonus: 5,
    description: '이미지 5개 + 보너스 5크레딧'
  },
  {
    id: 'premium',
    credits: 60,
    price: 19.99,
    originalPrice: 29.94,
    bonus: 15,
    description: '이미지 12개 + 보너스 15크레딧'
  },
  {
    id: 'pro',
    credits: 150,
    price: 39.99,
    originalPrice: 74.85,
    bonus: 50,
    description: '이미지 30개 + 보너스 50크레딧'
  }
];

export default function Credits() {
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const { data: credits, isLoading } = useQuery({
    queryKey: ['/api/credits'],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await fetch('/api/purchase-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packageId })
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "크레딧 구매 완료!",
        description: "새 크레딧이 계정에 추가되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
      setSelectedPackage(null);
    },
    onError: (error: any) => {
      toast({
        title: "구매 실패",
        description: error.message || "크레딧 구매 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  const handlePurchase = (packageId: string) => {
    setSelectedPackage(packageId);
    purchaseMutation.mutate(packageId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-4">
        <div className="container mx-auto max-w-4xl pt-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">크레딧 정보를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-4">
      <div className="container mx-auto max-w-4xl pt-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-sm border mb-4">
            <Coins className="h-5 w-5 text-yellow-500" />
            <span className="text-lg font-semibold">
              보유 크레딧: {(credits as any)?.credits || 0}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            드림샷 크레딧 구매
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            AI로 영화급 이미지와 립싱크 영상을 생성하세요. 크레딧으로 모든 기능을 이용할 수 있습니다.
          </p>
        </div>

        {/* 크레딧 사용법 */}
        <Card className="mb-8 border-0 shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              크레딧 사용법
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950">
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                  5
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">드림샷 이미지 생성</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">영화급 합성 이미지 1개</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-50 dark:bg-pink-950">
                <div className="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">
                  10
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">립싱크 영상 생성</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">AI 말하는 영상 1개</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 크레딧 패키지 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {creditPackages.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={`relative border-2 transition-all duration-200 hover:shadow-lg ${
                pkg.popular ? 'border-purple-500 shadow-purple-100' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-purple-600 text-white px-3 py-1">
                    인기
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Coins className="h-5 w-5 text-yellow-500" />
                  {pkg.credits}
                  {pkg.bonus && (
                    <Badge variant="secondary" className="ml-1">+{pkg.bonus}</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-sm">{pkg.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="text-center">
                <div className="mb-4">
                  {pkg.originalPrice && (
                    <p className="text-sm text-gray-500 line-through">
                      ${pkg.originalPrice.toFixed(2)}
                    </p>
                  )}
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    ${pkg.price.toFixed(2)}
                  </p>
                  {pkg.originalPrice && (
                    <p className="text-sm text-green-600 font-medium">
                      {Math.round((1 - pkg.price / pkg.originalPrice) * 100)}% 절약
                    </p>
                  )}
                </div>
                
                <Button 
                  className={`w-full ${
                    pkg.popular 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchaseMutation.isPending && selectedPackage === pkg.id}
                  data-testid={`button-purchase-${pkg.id}`}
                >
                  {purchaseMutation.isPending && selectedPackage === pkg.id ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      구매 중...
                    </div>
                  ) : (
                    '구매하기'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 추천 시스템 안내 */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Users className="h-5 w-5" />
              친구 추천하고 크레딧 받기!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Gift className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    친구 가입시 3+3 크레딧
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    추천인과 신규 가입자 모두 보상
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    결제시 30% 현금백
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    추천받은 친구가 구매하면 현금 리워드
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}