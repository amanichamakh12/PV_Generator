'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const pdDistribution = [
  { name: 'AAA-A', value: 35, fill: '#16a34a' },
  { name: 'BBB', value: 28, fill: '#eab308' },
  { name: 'BB-B', value: 22, fill: '#f97316' },
  { name: 'CCC+', value: 15, fill: '#ef4444' },
];

const eclTrend = [
  { month: 'Jan', ecl: 450, avgPd: 2.1 },
  { month: 'Fév', ecl: 480, avgPd: 2.3 },
  { month: 'Mar', ecl: 520, avgPd: 2.5 },
  { month: 'Avr', ecl: 510, avgPd: 2.4 },
  { month: 'Mai', ecl: 550, avgPd: 2.6 },
];

const segmentData = [
  { name: 'PME', clients: 45, avgPd: 3.2, avgEcl: 2.1 },
  { name: 'Corporate', clients: 28, avgPd: 1.8, avgEcl: 0.9 },
  { name: 'Retail', clients: 67, avgPd: 4.5, avgEcl: 3.2 },
];

export function AnalyticsContent() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytique</h1>
        <p className="text-muted-foreground mt-2">
          Tableaux de bord et analyses des risques
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tendance ECL et PD Moyen</CardTitle>
              <CardDescription>Évolution mensuelle</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={eclTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="ecl" stroke="#1e3a5f" name="ECL Total (M)" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="avgPd" stroke="#2d9f6c" name="PD Moyen %" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exposition par Segment</CardTitle>
              <CardDescription>Répartition des clients et risques</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={segmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="clients" fill="#1e3a5f" name="Nombre de clients" />
                  <Bar yAxisId="right" dataKey="avgPd" fill="#2d9f6c" name="PD Moyen %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribution des Ratings</CardTitle>
              <CardDescription>Répartition par classe de risque</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={pdDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pdDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Segments Tab */}
        <TabsContent value="segments" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {segmentData.map((segment) => (
              <Card key={segment.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{segment.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre de clients</p>
                    <p className="text-2xl font-bold text-primary">{segment.clients}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">PD Moyen</p>
                    <p className="text-2xl font-bold text-orange-600">{segment.avgPd.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ECL Moyen %</p>
                    <p className="text-2xl font-bold text-red-600">{segment.avgEcl.toFixed(1)}%</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
