"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Box,
  Container,
  Grid,
  Card,
  Heading,
  Text,
  Button,
  Flex,
  Badge,
} from "@radix-ui/themes";
import { Bed, Bath, Car, Square, Ruler } from "lucide-react";
import PropertyDetails from "./PropertyDetails";

interface Property {
  id: number;
  title: string;
  price: string;
  location: string;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  area: string;
  landArea: string;
  imageUrl: string;
  images?: string[];
  status: "For Sale" | "Under Offer" | "Sold" | "Deadline Sale" | "Coming Soon" | "Withdrawn";
  description: string;
  details: string;
  openHomes: string[];
  deadline?: string;
}

const properties: Property[] = [
  {
    id: 1,
    title: "62 Lord Street, STOKES VALLEY, Lower Hutt City",
    price: "CV: $630,000",
    location: "62 Lord Street, Stokes Valley, Lower Hutt City",
    bedrooms: 3,
    bathrooms: 1,
    parking: 2,
    area: "190m²",
    landArea: "2271m²",
    imageUrl: "/img/62-lord-street-stokes-valley/sold.jpg",
    images: [
      "/img/62-lord-street-stokes-valley/sold.jpg",
      "/img/62-lord-street-stokes-valley/index.webp",
      "/img/62-lord-street-stokes-valley/1850698a8f90e194d5c84dfd3166c47a.crop.1660x.webp",
      "/img/62-lord-street-stokes-valley/2812a1e1eeede15c64098207df989ecc.crop.1660x.webp",
      "/img/62-lord-street-stokes-valley/5bd705d356b0896be57f4b4c5a75548e.crop.1660x.webp",
      "/img/62-lord-street-stokes-valley/9944dd4a03221ea132698bd5175fa645.crop.1660x.webp",
    ],
    status: "Sold",
    description: "Your Own Slice Of Nature",
    details: `Discover the ideal balance of comfort, space, and tranquility in this beautifully maintained 1970s family home, set on an expansive approx. 2,271sqm section. Offering around 190sqm of living space, this home has been thoughtfully designed for relaxed family living.

Step inside to find brand-new carpet underfoot and freshly painted interior walls, giving the home a bright and welcoming feel from the moment you walk in. There are three generous double bedrooms, each with built-in wardrobes, and a well-appointed bathroom with a separate toilet. Downstairs, a tandem double garage offers versatility – use it as a workshop, hobby space, or extra storage, plus there’s also an extra toilet for convenience – perfect for when you're busy in the garden and don’t want to take your gumboots off!

The modernised kitchen makes cooking a pleasure, while the dining area connects seamlessly to the inviting living room. Two heat pumps and a gas burner keep the home warm and cosy over the winter months and large windows and sliding doors fill the space with natural light, opening out to a sunny balcony where you can enjoy your morning coffee or entertain friends while taking in the distant views.

The outdoor areas are a true highlight! A spacious yard provides plenty of off-street parking for cars, a boat, or a trailer, giving you flexibility for your lifestyle needs along with a lovely open deck which is ideal for family barbecues or simply soaking up the sun and enjoying the peace and quiet. The back garden invites you to grow flowers and vegetables, and even keep a few hens or small pets – perfect for those who love a touch of country life.

With convenient transport options, it’s just a 2-minute walk to the bus stop - don’t miss this opportunity to make this peaceful retreat your new family home. Come to an open home or book a private viewing today!`,
    openHomes: ["Sat, 1 Nov 2025, 1:00-1:30pm", "Sun, 2 Nov 2025, 1:00-1:30pm"],
    deadline: "Wednesday 12 November 2025 @ 1pm (unless sold prior)",
  },
  {
    id: 3,
    title: "1b Arawa Road, Hataitai, Wellington",
    price: "",
    location: "1b Arawa Road, Hataitai, Wellington 6021",
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    area: "75m²",
    landArea: "-",
    imageUrl: "/img/1B-Arawa-Road-Hataitai/6dgaz4ppoqi6tftmy6nrtdtc5a.jpg",
    status: "For Sale",
    description: "Modern apartment now on the market in sought-after Hataitai.",
    details: `Welcome to 1b Arawa Road — a beautifully presented apartment in the heart of Hataitai, now available for sale.

Key Details:
- Year Built: 1994
- Property Type: Residential Apartment
- Floor Area: 75m²

This well-maintained apartment offers a fantastic opportunity for first home buyers or investors looking to secure a property in one of Wellington's most desirable inner-city suburbs. Enjoy proximity to public transport, local cafes, and the stunning Wellington harbour.

Contact Marie Nian today to arrange a private viewing.`,
    openHomes: [],
  },
  {
    id: 4,
    title: "198 Sievers Grove, Cannons Creek, Porirua",
    price: "Withdrawn",
    location: "198 Sievers Grove, Cannons Creek, Porirua 5024",
    bedrooms: 3,
    bathrooms: 1,
    parking: 1,
    area: "101m²",
    landArea: "862m²",
    imageUrl: "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/q44d2miqwui7bkyg2g3gkdoly4.jpg",
    images: [
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/q44d2miqwui7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/lapcywaqwyi7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/as7kfiiqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/bhch6caqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/frgxvwyqw4i7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/k64qebiqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/kpu7reaqwyi7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/kzaltjyqwyi7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/l42l6maqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/n4xuqlqqwui7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/phe7ucqqwui7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/phzdaeaqw4i7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/po3ynyiqw4i7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/q44d2miqwui7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/qbcjv2aqwui7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/qovolsqqw4i7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/ssoqugyqwui7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/w77d3iqqwyi7bkyg2g3gkdoly4.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/xuatg4aqwyi7bjwvhw6kn3s33u.jpg",
      "/img/198-Sievers%20Grove-Cannons-Creek-Porirua/ywydnaaqwui7bkyg2g3gkdoly4.jpg",
    ],
    status: "Withdrawn",
    description: "Spacious residential property with high potential. Built in 1967.",
    details: `About 198 Sievers Grove, Cannons Creek, Porirua, 5024:
198 Sievers Grove is a residential property built in 1967 with 3 bedrooms, 1 bathroom and 1 parking space. The property is estimated to be valued in the range of $550,000 to $600,000.

Property History & Valuation:
- Last Sold: 3 June 2019 for $390,000 (Sold by Double Winkel Real Estate Ltd Professionals, Porirua)
- Market Time: Sold in 22 days in 2019.
- Rating Valuation (1 Oct 2022):
  * Capital Value: $590,000
  * Land Value: $365,000
  * Improvement Value: $225,000

Status: This property was previously listed by Marie. After several open homes, the seller has decided to withdraw the property from the market for the time being.`,
    openHomes: [],
  },
];

import { translations, Language } from "../lib/translations";

export default function PropertyListings({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].properties;
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "For Sale":
        return "green";
      case "Under Offer":
        return "orange";
      case "Sold":
        return "gray";
      case "Coming Soon":
        return "blue";
      case "Withdrawn":
        return "red";
      default:
        return "blue";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "Sold": return t.status.sold;
      case "For Sale": return t.status.sale;
      case "Under Offer": return t.status.offer;
      case "Deadline Sale": return t.status.deadline;
      case "Coming Soon": return t.status.soon;
      case "Withdrawn": return t.status.withdrawn;
      default: return status;
    }
  };

  return (
    <Box id="properties" py="9" style={{ backgroundColor: "var(--gray-1)" }}>
      <Container size="4" px="6">
        {/* Section Header */}
        <Flex direction="column" align="center" mb="8">
          <Heading
            as="h2"
            size="8"
            weight="bold"
            mb="4"
            style={{ textAlign: "center", color: "var(--gray-12)" }}
          >
            {t.title}
          </Heading>
          <Text
            size="4"
            style={{
              textAlign: "center",
              color: "var(--gray-11)",
              maxWidth: "600px",
              lineHeight: 1.6,
            }}
          >
            {t.subtitle}
          </Text>
        </Flex>

        {/* Properties Grid */}
        <Grid columns={{ initial: "1", md: "2" }} gap="6" justify="center">
          {properties.map((property) => (
            <Card
              key={property.id}
              className="property-card"
              style={{
                overflow: "hidden",
                backgroundColor: "white",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                maxWidth: "800px",
                margin: "0 auto",
              }}
            >
              {/* Property Image */}
              <Box
                className="property-image"
                style={{
                  position: "relative",
                  backgroundColor: "var(--gray-3)", // fallback color
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedProperty(property)}
              >
                <Image
                  src={property.imageUrl}
                  alt={property.title}
                  fill
                  style={{
                    objectFit: "cover",
                    objectPosition: "top center",
                  }}
                  priority={false}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 50vw, 50vw"
                />
                {/* Status Badge */}
                <Box
                  style={{ position: "absolute", top: "12px", right: "12px" }}
                >
                  <Badge
                    color={getStatusColor(property.status)}
                    size="2"
                    style={{ fontWeight: 600 }}
                  >
                    {getStatusText(property.status)}
                  </Badge>
                </Box>

                {/* Price Tag */}
                {property.price && (
                  <Box
                    style={{
                      position: "absolute",
                      bottom: "12px",
                      left: "12px",
                      backgroundColor: "rgba(0, 0, 0, 0.8)",
                      color: "white",
                      padding: "8px 12px",
                      borderRadius: "6px",
                    }}
                  >
                    <Text size="3" weight="bold">
                      {property.price}
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Property Details */}
              <Box p="4">
                <Heading
                  as="h3"
                  size="4"
                  weight="bold"
                  mb="2"
                  className="line-clamp-2"
                >
                  {property.title}
                </Heading>

                <Flex align="center" gap="2" mb="3">
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "red", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: "bold" }}>
                    $
                  </div>
                  <Text size="2" style={{ color: "var(--gray-11)", fontWeight: 500 }}>
                    {property.deadline ? `${getStatusText(property.status)} ${property.deadline}` : getStatusText(property.status)}
                  </Text>
                </Flex>

                <Text
                  size="2"
                  mb="4"
                  style={{
                    color: "var(--gray-10)",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {property.description}
                </Text>

                {/* Property Features */}
                <Flex wrap="wrap" gap="4" mb="4">
                  <Flex align="center" gap="1">
                    <Bed size={16} style={{ color: "var(--gray-9)" }} />
                    <Text size="2" style={{ color: "var(--gray-11)" }}>
                      {property.bedrooms} {t.bed}
                    </Text>
                  </Flex>

                  <Flex align="center" gap="1">
                    <Bath size={16} style={{ color: "var(--gray-9)" }} />
                    <Text size="2" style={{ color: "var(--gray-11)" }}>
                      {property.bathrooms} {t.bath}
                    </Text>
                  </Flex>

                  <Flex align="center" gap="1">
                    <Car size={16} style={{ color: "var(--gray-9)" }} />
                    <Text size="2" style={{ color: "var(--gray-11)" }}>
                      {property.parking} {t.parking}
                    </Text>
                  </Flex>

                  <Flex align="center" gap="1">
                    <Square size={16} style={{ color: "var(--gray-9)" }} />
                    <Text size="2" style={{ color: "var(--gray-11)" }}>
                      {t.floor} {property.area}
                    </Text>
                  </Flex>

                  <Flex align="center" gap="1">
                    <Ruler size={16} style={{ color: "var(--gray-9)" }} />
                    <Text size="2" style={{ color: "var(--gray-11)" }}>
                      {t.land} {property.landArea}
                    </Text>
                  </Flex>
                </Flex>

                {/* Action Buttons */}
                <Flex gap="2">
                  <Button
                    variant="solid"
                    size="2"
                    style={{
                      backgroundColor: "var(--blue-9)",
                      color: "white",
                      flex: 1,
                      fontSize: "0.875rem",
                    }}
                    onClick={() => setSelectedProperty(property)}
                  >
                    {t.viewDetails}
                  </Button>
                </Flex>
              </Box>
            </Card>
          ))}
        </Grid>


      </Container>

      {selectedProperty && (
        <PropertyDetails
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          lang={lang}
        />
      )}
    </Box>
  );
}
