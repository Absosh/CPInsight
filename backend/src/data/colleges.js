const colleges = [
  { id: 'iit-bhilai', officialName: 'Indian Institute of Technology Bhilai', shortName: 'IIT Bhilai', instituteType: 'IIT', state: 'Chhattisgarh' },
  { id: 'iit-bhubaneswar', officialName: 'Indian Institute of Technology Bhubaneswar', shortName: 'IIT Bhubaneswar', instituteType: 'IIT', state: 'Odisha' },
  { id: 'iit-bombay', officialName: 'Indian Institute of Technology Bombay', shortName: 'IIT Bombay', instituteType: 'IIT', state: 'Maharashtra' },
  { id: 'iit-delhi', officialName: 'Indian Institute of Technology Delhi', shortName: 'IIT Delhi', instituteType: 'IIT', state: 'Delhi' },
  { id: 'iit-dhanbad', officialName: 'Indian Institute of Technology (Indian School of Mines) Dhanbad', shortName: 'IIT Dhanbad', instituteType: 'IIT', state: 'Jharkhand' },
  { id: 'iit-dharwad', officialName: 'Indian Institute of Technology Dharwad', shortName: 'IIT Dharwad', instituteType: 'IIT', state: 'Karnataka' },
  { id: 'iit-gandhinagar', officialName: 'Indian Institute of Technology Gandhinagar', shortName: 'IIT Gandhinagar', instituteType: 'IIT', state: 'Gujarat' },
  { id: 'iit-goa', officialName: 'Indian Institute of Technology Goa', shortName: 'IIT Goa', instituteType: 'IIT', state: 'Goa' },
  { id: 'iit-guwahati', officialName: 'Indian Institute of Technology Guwahati', shortName: 'IIT Guwahati', instituteType: 'IIT', state: 'Assam' },
  { id: 'iit-hyderabad', officialName: 'Indian Institute of Technology Hyderabad', shortName: 'IIT Hyderabad', instituteType: 'IIT', state: 'Telangana' },
  { id: 'iit-indore', officialName: 'Indian Institute of Technology Indore', shortName: 'IIT Indore', instituteType: 'IIT', state: 'Madhya Pradesh' },
  { id: 'iit-jammu', officialName: 'Indian Institute of Technology Jammu', shortName: 'IIT Jammu', instituteType: 'IIT', state: 'Jammu and Kashmir' },
  { id: 'iit-jodhpur', officialName: 'Indian Institute of Technology Jodhpur', shortName: 'IIT Jodhpur', instituteType: 'IIT', state: 'Rajasthan' },
  { id: 'iit-kanpur', officialName: 'Indian Institute of Technology Kanpur', shortName: 'IIT Kanpur', instituteType: 'IIT', state: 'Uttar Pradesh' },
  { id: 'iit-kharagpur', officialName: 'Indian Institute of Technology Kharagpur', shortName: 'IIT Kharagpur', instituteType: 'IIT', state: 'West Bengal' },
  { id: 'iit-madras', officialName: 'Indian Institute of Technology Madras', shortName: 'IIT Madras', instituteType: 'IIT', state: 'Tamil Nadu' },
  { id: 'iit-mandi', officialName: 'Indian Institute of Technology Mandi', shortName: 'IIT Mandi', instituteType: 'IIT', state: 'Himachal Pradesh' },
  { id: 'iit-palakkad', officialName: 'Indian Institute of Technology Palakkad', shortName: 'IIT Palakkad', instituteType: 'IIT', state: 'Kerala' },
  { id: 'iit-patna', officialName: 'Indian Institute of Technology Patna', shortName: 'IIT Patna', instituteType: 'IIT', state: 'Bihar' },
  { id: 'iit-roorkee', officialName: 'Indian Institute of Technology Roorkee', shortName: 'IIT Roorkee', instituteType: 'IIT', state: 'Uttarakhand' },
  { id: 'iit-ropar', officialName: 'Indian Institute of Technology Ropar', shortName: 'IIT Ropar', instituteType: 'IIT', state: 'Punjab' },
  { id: 'iit-tirupati', officialName: 'Indian Institute of Technology Tirupati', shortName: 'IIT Tirupati', instituteType: 'IIT', state: 'Andhra Pradesh' },
  { id: 'iit-varanasi', officialName: 'Indian Institute of Technology (Banaras Hindu University) Varanasi', shortName: 'IIT BHU Varanasi', instituteType: 'IIT', state: 'Uttar Pradesh' },
  { id: 'nit-agartala', officialName: 'National Institute of Technology Agartala', shortName: 'NIT Agartala', instituteType: 'NIT', state: 'Tripura' },
  { id: 'nit-allahabad', officialName: 'Motilal Nehru National Institute of Technology Allahabad', shortName: 'MNNIT Allahabad', instituteType: 'NIT', state: 'Uttar Pradesh' },
  { id: 'nit-andhra-pradesh', officialName: 'National Institute of Technology Andhra Pradesh', shortName: 'NIT Andhra Pradesh', instituteType: 'NIT', state: 'Andhra Pradesh' },
  { id: 'nit-arunachal-pradesh', officialName: 'National Institute of Technology Arunachal Pradesh', shortName: 'NIT Arunachal Pradesh', instituteType: 'NIT', state: 'Arunachal Pradesh' },
  { id: 'nit-bhopal', officialName: 'Maulana Azad National Institute of Technology Bhopal', shortName: 'MANIT Bhopal', instituteType: 'NIT', state: 'Madhya Pradesh' },
  { id: 'nit-calicut', officialName: 'National Institute of Technology Calicut', shortName: 'NIT Calicut', instituteType: 'NIT', state: 'Kerala' },
  { id: 'nit-delhi', officialName: 'National Institute of Technology Delhi', shortName: 'NIT Delhi', instituteType: 'NIT', state: 'Delhi' },
  { id: 'nit-durgapur', officialName: 'National Institute of Technology Durgapur', shortName: 'NIT Durgapur', instituteType: 'NIT', state: 'West Bengal' },
  { id: 'nit-goa', officialName: 'National Institute of Technology Goa', shortName: 'NIT Goa', instituteType: 'NIT', state: 'Goa' },
  { id: 'nit-hamirpur', officialName: 'National Institute of Technology Hamirpur', shortName: 'NIT Hamirpur', instituteType: 'NIT', state: 'Himachal Pradesh' },
  { id: 'nit-jaipur', officialName: 'Malaviya National Institute of Technology Jaipur', shortName: 'MNIT Jaipur', instituteType: 'NIT', state: 'Rajasthan' },
  { id: 'nit-jalandhar', officialName: 'Dr B R Ambedkar National Institute of Technology Jalandhar', shortName: 'NIT Jalandhar', instituteType: 'NIT', state: 'Punjab' },
  { id: 'nit-jamshedpur', officialName: 'National Institute of Technology Jamshedpur', shortName: 'NIT Jamshedpur', instituteType: 'NIT', state: 'Jharkhand' },
  { id: 'nit-kurukshetra', officialName: 'National Institute of Technology Kurukshetra', shortName: 'NIT Kurukshetra', instituteType: 'NIT', state: 'Haryana' },
  { id: 'nit-manipur', officialName: 'National Institute of Technology Manipur', shortName: 'NIT Manipur', instituteType: 'NIT', state: 'Manipur' },
  { id: 'nit-meghalaya', officialName: 'National Institute of Technology Meghalaya', shortName: 'NIT Meghalaya', instituteType: 'NIT', state: 'Meghalaya' },
  { id: 'nit-mizoram', officialName: 'National Institute of Technology Mizoram', shortName: 'NIT Mizoram', instituteType: 'NIT', state: 'Mizoram' },
  { id: 'nit-nagaland', officialName: 'National Institute of Technology Nagaland', shortName: 'NIT Nagaland', instituteType: 'NIT', state: 'Nagaland' },
  { id: 'nit-nagpur', officialName: 'Visvesvaraya National Institute of Technology Nagpur', shortName: 'VNIT Nagpur', instituteType: 'NIT', state: 'Maharashtra' },
  { id: 'nit-patna', officialName: 'National Institute of Technology Patna', shortName: 'NIT Patna', instituteType: 'NIT', state: 'Bihar' },
  { id: 'nit-puducherry', officialName: 'National Institute of Technology Puducherry', shortName: 'NIT Puducherry', instituteType: 'NIT', state: 'Puducherry' },
  { id: 'nit-raipur', officialName: 'National Institute of Technology Raipur', shortName: 'NIT Raipur', instituteType: 'NIT', state: 'Chhattisgarh' },
  { id: 'nit-rourkela', officialName: 'National Institute of Technology Rourkela', shortName: 'NIT Rourkela', instituteType: 'NIT', state: 'Odisha' },
  { id: 'nit-sikkim', officialName: 'National Institute of Technology Sikkim', shortName: 'NIT Sikkim', instituteType: 'NIT', state: 'Sikkim' },
  { id: 'nit-silchar', officialName: 'National Institute of Technology Silchar', shortName: 'NIT Silchar', instituteType: 'NIT', state: 'Assam' },
  { id: 'nit-srinagar', officialName: 'National Institute of Technology Srinagar', shortName: 'NIT Srinagar', instituteType: 'NIT', state: 'Jammu and Kashmir' },
  { id: 'nit-surat', officialName: 'Sardar Vallabhbhai National Institute of Technology Surat', shortName: 'SVNIT Surat', instituteType: 'NIT', state: 'Gujarat' },
  { id: 'nit-surathkal', officialName: 'National Institute of Technology Karnataka Surathkal', shortName: 'NITK Surathkal', instituteType: 'NIT', state: 'Karnataka' },
  { id: 'nit-tiruchirappalli', officialName: 'National Institute of Technology Tiruchirappalli', shortName: 'NIT Tiruchirappalli', instituteType: 'NIT', state: 'Tamil Nadu' },
  { id: 'nit-uttarakhand', officialName: 'National Institute of Technology Uttarakhand', shortName: 'NIT Uttarakhand', instituteType: 'NIT', state: 'Uttarakhand' },
  { id: 'nit-warangal', officialName: 'National Institute of Technology Warangal', shortName: 'NIT Warangal', instituteType: 'NIT', state: 'Telangana' }
];

function listColleges(search = '') {
  const query = search.trim().toLowerCase();
  if (!query) return colleges;

  return colleges.filter((college) => [
    college.id,
    college.officialName,
    college.shortName,
    college.instituteType,
    college.state
  ].some((value) => value.toLowerCase().includes(query)));
}

function findCollege(id) {
  if (!id) return null;
  return colleges.find((college) => college.id === id) || null;
}

module.exports = { colleges, listColleges, findCollege };
