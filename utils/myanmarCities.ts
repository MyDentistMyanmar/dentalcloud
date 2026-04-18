// Myanmar Cities and Townships Data
// Source: https://github.com/bilions-org/myanmar-cities

export interface MyanmarCity {
  name: string;
  township: string;
}

// Myanmar townships (major townships for each region/state)
export const myanmarTownships: string[] = [
  'Yangon',
  'Mandalay',
  'Naypyidaw',
  'Pyin Oo Lwin',
  'Meiktila',
  'Myingyan',
  'Kyaukse',
  'Sagaing',
  'Monywa',
  'Shwebo',
  'Bago',
  'Pyay',
  'Taungoo',
  'Pathein',
  'Hinthada',
  'Magway',
  'Pakokku',
  'Dawei',
  'Myeik',
  'Mawlamyine',
  'Hpa-An',
  'Loikaw',
  'Taunggyi',
  'Lashio',
  'Muse',
  'Kengtung',
  'Myitkyina',
  'Bhamo',
  'Hakha',
  'Sittwe',
  'Chin State'
];

export const myanmarCities: MyanmarCity[] = [
  // Yangon Region
  { name: 'Yangon', township: 'Yangon' },
  { name: 'Thanlyin', township: 'Thanlyin' },
  { name: 'Insein', township: 'Insein' },
  { name: 'Taikkyi', township: 'Taikkyi' },
  { name: 'Hmawbi', township: 'Hmawbi' },
  { name: 'Hlegu', township: 'Hlegu' },
  { name: 'Kyauktan', township: 'Kyauktan' },
  { name: 'Twante', township: 'Twante' },
  { name: 'Kawhmu', township: 'Kawhmu' },
  { name: 'Kayan', township: 'Kayan' },
  { name: 'Dala', township: 'Dala' },
  { name: 'Seikgyi Kanaungto', township: 'Seikgyi Kanaungto' },
  { name: 'Cocokyun', township: 'Cocokyun' },
  
  // Mandalay Region
  { name: 'Mandalay', township: 'Mandalay' },
  { name: 'Pyin Oo Lwin', township: 'Pyin Oo Lwin' },
  { name: 'Myingyan', township: 'Myingyan' },
  { name: 'Kyaukse', township: 'Kyaukse' },
  { name: 'Meiktila', township: 'Meiktila' },
  { name: 'Nyaung U', township: 'Nyaung U' },
  { name: 'Yamethin', township: 'Yamethin' },
  { name: 'Madaya', township: 'Madaya' },
  { name: 'Mogok', township: 'Mogok' },
  { name: 'Singu', township: 'Singu' },
  { name: 'Myittha', township: 'Myittha' },
  { name: 'Wundwin', township: 'Wundwin' },
  { name: 'Mahlaing', township: 'Mahlaing' },
  { name: 'Tada-U', township: 'Tada-U' },
  { name: 'Patheingyi', township: 'Patheingyi' },
  { name: 'Aungmyethazan', township: 'Aungmyethazan' },
  
  // Sagaing Region
  { name: 'Sagaing', township: 'Sagaing' },
  { name: 'Monywa', township: 'Monywa' },
  { name: 'Shwebo', township: 'Shwebo' },
  { name: 'Kanbalu', township: 'Kanbalu' },
  { name: 'Katha', township: 'Katha' },
  { name: 'Indaw', township: 'Indaw' },
  { name: 'Mawlaik', township: 'Mawlaik' },
  { name: 'Kalay', township: 'Kalay' },
  { name: 'Tamu', township: 'Tamu' },
  { name: 'Kalewa', township: 'Kalewa' },
  { name: 'Khamti', township: 'Khamti' },
  { name: 'Homalin', township: 'Homalin' },
  
  // Bago Region
  { name: 'Bago', township: 'Bago' },
  { name: 'Pyay', township: 'Pyay' },
  { name: 'Taungoo', township: 'Taungoo' },
  { name: 'Tharyarwady', township: 'Tharyarwady' },
  { name: 'Letpadan', township: 'Letpadan' },
  { name: 'Okpho', township: 'Okpho' },
  { name: 'Waw', township: 'Waw' },
  { name: 'Kyauktaga', township: 'Kyauktaga' },
  { name: 'Daik-U', township: 'Daik-U' },
  { name: 'Shwegyin', township: 'Shwegyin' },
  { name: 'Phyu', township: 'Phyu' },
  
  // Ayeyarwady Region
  { name: 'Pathein', township: 'Pathein' },
  { name: 'Hinthada', township: 'Hinthada' },
  { name: 'Myaungmya', township: 'Myaungmya' },
  { name: 'Maubin', township: 'Maubin' },
  { name: 'Kyonpyaw', township: 'Kyonpyaw' },
  { name: 'Bogale', township: 'Bogale' },
  { name: 'Lemyethna', township: 'Lemyethna' },
  { name: 'Kangyidaunt', township: 'Kangyidaunt' },
  { name: 'Myanaung', township: 'Myanaung' },
  { name: 'Ingapu', township: 'Ingapu' },
  { name: 'Einme', township: 'Einme' },
  { name: 'Wakema', township: 'Wakema' },
  
  // Magway Region
  { name: 'Magway', township: 'Magway' },
  { name: 'Pakokku', township: 'Pakokku' },
  { name: 'Minbu', township: 'Minbu' },
  { name: 'Thayet', township: 'Thayet' },
  { name: 'Gangaw', township: 'Gangaw' },
  { name: 'Chauk', township: 'Chauk' },
  { name: 'Natmauk', township: 'Natmauk' },
  { name: 'Myothit', township: 'Myothit' },
  { name: 'Salin', township: 'Salin' },
  { name: 'Mindon', township: 'Mindon' },
  { name: 'Tayet', township: 'Tayet' },
  
  // Tanintharyi Region
  { name: 'Dawei', township: 'Dawei' },
  { name: 'Myeik', township: 'Myeik' },
  { name: 'Kawthaung', township: 'Kawthaung' },
  { name: 'Tanintharyi', township: 'Tanintharyi' },
  { name: 'Kyunsu', township: 'Kyunsu' },
  { name: 'Palaw', township: 'Palaw' },
  { name: 'Yebyu', township: 'Yebyu' },
  { name: 'Launglon', township: 'Launglon' },
  
  // Mon State
  { name: 'Mawlamyine', township: 'Mawlamyine' },
  { name: 'Thaton', township: 'Thaton' },
  { name: 'Ye', township: 'Ye' },
  { name: 'Kyaikmaraw', township: 'Kyaikmaraw' },
  { name: 'Mudon', township: 'Mudon' },
  { name: 'Chaungzon', township: 'Chaungzon' },
  { name: 'Bilin', township: 'Bilin' },
  
  // Kayin State
  { name: 'Hpa-An', township: 'Hpa-An' },
  { name: 'Myawaddy', township: 'Myawaddy' },
  { name: 'Kawkareik', township: 'Kawkareik' },
  { name: 'Hpapun', township: 'Hpapun' },
  
  // Kayah State
  { name: 'Loikaw', township: 'Loikaw' },
  { name: 'Demoso', township: 'Demoso' },
  { name: 'Bawlakhe', township: 'Bawlakhe' },
  { name: 'Mese', township: 'Mese' },
  
  // Shan State
  { name: 'Taunggyi', township: 'Taunggyi' },
  { name: 'Lashio', township: 'Lashio' },
  { name: 'Muse', township: 'Muse' },
  { name: 'Kengtung', township: 'Kengtung' },
  { name: 'Tachileik', township: 'Tachileik' },
  { name: 'Hsipaw', township: 'Hsipaw' },
  { name: 'Kyaukme', township: 'Kyaukme' },
  { name: 'Langkho', township: 'Langkho' },
  { name: 'Kunlong', township: 'Kunlong' },
  { name: 'Mong Hsat', township: 'Mong Hsat' },
  { name: 'Mong Hpayak', township: 'Mong Hpayak' },
  
  // Kachin State
  { name: 'Myitkyina', township: 'Myitkyina' },
  { name: 'Bhamo', township: 'Bhamo' },
  { name: 'Mohnyin', township: 'Mohnyin' },
  { name: 'Moguang', township: 'Moguang' },
  { name: 'Putao', township: 'Putao' },
  { name: 'Waingmaw', township: 'Waingmaw' },
  
  // Chin State
  { name: 'Hakha', township: 'Hakha' },
  { name: 'Falam', township: 'Falam' },
  { name: 'Matupi', township: 'Matupi' },
  { name: 'Mindat', township: 'Mindat' },
  
  // Rakhine State
  { name: 'Sittwe', township: 'Sittwe' },
  { name: 'Kyaukpyu', township: 'Kyaukpyu' },
  { name: 'Mrauk-U', township: 'Mrauk-U' },
  { name: 'Thandwe', township: 'Thandwe' },
  { name: 'Maungdaw', township: 'Maungdaw' },
  { name: 'Buthidaung', township: 'Buthidaung' },
  { name: 'Rathedaung', township: 'Rathedaung' },
  { name: 'Pauktaw', township: 'Pauktaw' },
  
  // Naypyidaw
  { name: 'Naypyidaw', township: 'Naypyidaw' }
];

// Get unique cities sorted alphabetically
export const getMyanmarCities = (): string[] => {
  return [...new Set(myanmarCities.map(city => city.name))].sort();
};

// Get township for a city
export const getTownshipForCity = (city: string): string | undefined => {
  const found = myanmarCities.find(c => c.name === city);
  return found?.township;
};

// Get all cities as options for dropdown
export const getCityOptions = (): { value: string; label: string; township: string }[] => {
  return myanmarCities
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(city => ({
      value: city.name,
      label: city.name,
      township: city.township
    }));
};
