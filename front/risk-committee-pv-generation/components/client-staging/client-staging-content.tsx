'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit2, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { ClientStagingAnalysis } from '@/types/client-staging';

const mockAnalyses: ClientStagingAnalysis[] = [
  {
    analysisId: 'CSA-001',
    clientId: 'CLT-001',
    clientInfo: {
      clientId: 'CLT-001',
      name: 'Société ABC SARL',
      segment: 'PME',
      industry: 'Retail',
      riskRating: 'Medium',
    },
    financialIndicators: {
      revenue: 15000000,
      netIncome: 1500000,
      totalAssets: 8000000,
      totalLiabilities: 3000000,
      workingCapital: 500000,
      debtToEquity: 0.6,
      currentRatio: 1.8,
      profitMargin: 0.1,
      roe: 0.25,
      roa: 0.19,
    },
    pdFactors: {
      macroeconomicScore: 65,
      industryRiskScore: 55,
      companyFinancialScore: 72,
      paymentHistoryScore: 85,
      managementQualityScore: 70,
    },
    pd: {
      pdPercentage: 2.8,
      pdRating: 'A',
      confidenceLevel: 85,
      calculatedAt: new Date(),
    },
    ead: {
      outstandingBalance: 2500000,
      creditLimit: 3000000,
      uncommittedFacilities: 500000,
      totalExposure: 3500000,
    },
    lgd: {
      collateralValue: 2000000,
      collateralType: 'Hypothèque immobilière',
      recoveryRate: 75,
      lgdPercentage: 25,
    },
    ecl: {
      pd: 0.028,
      ead: 3500000,
      lgd: 0.25,
      eclAmount: 245000,
      eclPercentage: 0.07,
      riskCategory: 'Stage 1',
      calculatedAt: new Date(),
    },
    analysisDate: new Date('2024-05-15'),
    updatedAt: new Date('2024-05-15'),
    createdBy: 'Admin',
    notes: 'Analyse de routine trimestrielle',
  },
  {
    analysisId: 'CSA-002',
    clientId: 'CLT-002',
    clientInfo: {
      clientId: 'CLT-002',
      name: 'Group XYZ Corp',
      segment: 'Corporate',
      industry: 'Manufacturing',
      riskRating: 'Low',
    },
    financialIndicators: {
      revenue: 150000000,
      netIncome: 15000000,
      totalAssets: 80000000,
      totalLiabilities: 30000000,
      workingCapital: 10000000,
      debtToEquity: 0.6,
      currentRatio: 2.2,
      profitMargin: 0.1,
      roe: 0.3,
      roa: 0.19,
    },
    pdFactors: {
      macroeconomicScore: 75,
      industryRiskScore: 65,
      companyFinancialScore: 82,
      paymentHistoryScore: 95,
      managementQualityScore: 85,
    },
    pd: {
      pdPercentage: 1.2,
      pdRating: 'AA',
      confidenceLevel: 92,
      calculatedAt: new Date(),
    },
    ead: {
      outstandingBalance: 25000000,
      creditLimit: 30000000,
      uncommittedFacilities: 5000000,
      totalExposure: 35000000,
    },
    lgd: {
      collateralValue: 28000000,
      collateralType: 'Garanties multiples',
      recoveryRate: 85,
      lgdPercentage: 15,
    },
    ecl: {
      pd: 0.012,
      ead: 35000000,
      lgd: 0.15,
      eclAmount: 63000,
      eclPercentage: 0.0018,
      riskCategory: 'Stage 1',
      calculatedAt: new Date(),
    },
    analysisDate: new Date('2024-05-14'),
    updatedAt: new Date('2024-05-14'),
    createdBy: 'Admin',
    notes: 'Client premium, bonne santé financière',
  },
];

function getRiskColor(percentage: number) {
  if (percentage < 2) return 'bg-green-50';
  if (percentage < 5) return 'bg-yellow-50';
  if (percentage < 10) return 'bg-orange-50';
  return 'bg-red-50';
}

function getRiskBadgeVariant(rating: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (rating.startsWith('AA')) return 'default';
  if (rating.startsWith('A')) return 'secondary';
  if (rating.startsWith('B')) return 'outline';
  return 'destructive';
}

export function ClientStagingContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  const filteredAnalyses = mockAnalyses.filter((analysis) =>
    analysis.clientInfo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Client Staging</h1>
          <p className="text-muted-foreground mt-2">
            Analyse et calcul des risques de crédit (PD/ECL)
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary-dark">
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Analyse
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="scenarios">Scénarios</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Clients Analysés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{mockAnalyses.length}</div>
                <p className="text-xs text-muted-foreground mt-1">+2 cette semaine</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Exposition Totale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {(mockAnalyses.reduce((sum, a) => sum + a.ead.totalExposure, 0) / 1000000).toFixed(1)}M
                </div>
                <p className="text-xs text-muted-foreground mt-1">DH</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">ECL Moyen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">
                  {(mockAnalyses.reduce((sum, a) => sum + a.ecl.eclPercentage, 0) / mockAnalyses.length * 100).toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Perte attendue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Risque Élevé</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {mockAnalyses.filter(a => a.pd.pdPercentage > 5).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Clients</p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Analyses List */}
          <Card>
            <CardHeader>
              <CardTitle>Analyses Récentes</CardTitle>
              <CardDescription>
                Cliquez sur une ligne pour voir les détails complets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead className="text-right">PD %</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead className="text-right">Exposition</TableHead>
                      <TableHead className="text-right">ECL</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnalyses.map((analysis) => (
                      <TableRow
                        key={analysis.analysisId}
                        className={`cursor-pointer hover:bg-muted transition-colors ${getRiskColor(analysis.pd.pdPercentage)}`}
                      >
                        <TableCell className="font-medium">
                          {analysis.clientInfo.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{analysis.clientInfo.segment}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {analysis.pd.pdPercentage.toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRiskBadgeVariant(analysis.pd.pdRating)}>
                            {analysis.pd.pdRating}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {(analysis.ead.totalExposure / 1000000).toFixed(2)}M
                        </TableCell>
                        <TableCell className="text-right font-semibold text-accent">
                          {(analysis.ecl.eclAmount / 1000000).toFixed(2)}M
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              analysis.ecl.riskCategory === 'Stage 1'
                                ? 'secondary'
                                : analysis.ecl.riskCategory === 'Stage 2'
                                  ? 'outline'
                                  : 'destructive'
                            }
                          >
                            {analysis.ecl.riskCategory}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Détails de l'Analyse PD/ECL</CardTitle>
              <CardDescription>
                Informations complètes du premier client sélectionné
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {mockAnalyses.length > 0 && (
                <>
                  {/* Client Info */}
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        📋
                      </div>
                      Informations Client
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Nom</p>
                        <p className="font-semibold">{mockAnalyses[0].clientInfo.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Segment</p>
                        <p className="font-semibold">{mockAnalyses[0].clientInfo.segment}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Secteur</p>
                        <p className="font-semibold">{mockAnalyses[0].clientInfo.industry}</p>
                      </div>
                    </div>
                  </div>

                  {/* PD Calculation */}
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                      Probabilité de Défaut (PD)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">PD %</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {mockAnalyses[0].pd.pdPercentage.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Rating</p>
                          <p className="text-xl font-bold">{mockAnalyses[0].pd.pdRating}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Confiance</p>
                          <p className="text-lg font-semibold">{mockAnalyses[0].pd.confidenceLevel}%</p>
                        </div>
                      </div>
                      <div className="bg-muted p-4 rounded-lg space-y-2">
                        <p className="text-sm font-semibold">Facteurs PD</p>
                        {Object.entries(mockAnalyses[0].pdFactors).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className="text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span className="font-semibold">{value}/100</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ECL Calculation */}
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      Perte de Crédit Attendue (ECL)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="bg-red-50 border-red-200">
                        <CardContent className="pt-6 space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground">ECL (Montant)</p>
                            <p className="text-3xl font-bold text-red-600">
                              {(mockAnalyses[0].ecl.eclAmount / 1000000).toFixed(2)}M
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">ECL %</p>
                            <p className="text-xl font-semibold">
                              {(mockAnalyses[0].ecl.eclPercentage * 100).toFixed(3)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Catégorie IFRS9</p>
                            <p className="font-semibold">{mockAnalyses[0].ecl.riskCategory}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm text-muted-foreground mb-2">Composantes de l&apos;ECL</p>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm">PD</span>
                              <span className="font-semibold">{(mockAnalyses[0].ecl.pd * 100).toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">EAD</span>
                              <span className="font-semibold">
                                {(mockAnalyses[0].ecl.ead / 1000000).toFixed(2)}M
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">LGD</span>
                              <span className="font-semibold">{(mockAnalyses[0].ecl.lgd * 100).toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Formule: ECL = PD × EAD × LGD
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scenarios Tab */}
        <TabsContent value="scenarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analyse de Scénarios</CardTitle>
              <CardDescription>
                Projections d'ECL avec différents ajustements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'Scénario Pessimiste', pdAdj: 50, eadAdj: 20, lgdAdj: 30 },
                  { name: 'Scénario Central', pdAdj: 0, eadAdj: 0, lgdAdj: 0 },
                  { name: 'Scénario Optimiste', pdAdj: -30, eadAdj: -10, lgdAdj: -20 },
                ].map((scenario, idx) => {
                  const baseAnalysis = mockAnalyses[0];
                  const adjustedEcl = baseAnalysis.ecl.eclAmount *
                    (1 + scenario.pdAdj / 100) *
                    (1 + scenario.eadAdj / 100) *
                    (1 + scenario.lgdAdj / 100);

                  return (
                    <Card key={idx} className="border-l-4 border-l-primary">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-semibold">{scenario.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Ajustements: PD {scenario.pdAdj > 0 ? '+' : ''}{scenario.pdAdj}%, EAD {scenario.eadAdj > 0 ? '+' : ''}{scenario.eadAdj}%, LGD {scenario.lgdAdj > 0 ? '+' : ''}{scenario.lgdAdj}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">ECL Projeté</p>
                            <p className="text-2xl font-bold text-primary">
                              {(adjustedEcl / 1000000).toFixed(2)}M
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
