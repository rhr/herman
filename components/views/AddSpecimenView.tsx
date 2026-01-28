import React from 'react';
import SpecimenForm from '../SpecimenForm';
import { useSpecimenUrl } from '../../hooks/useSpecimenUrl';

interface AddSpecimenViewProps {
  onSubmit: (data: any) => void;
}

const AddSpecimenView: React.FC<AddSpecimenViewProps> = ({ onSubmit }) => {
  const { navigateToGallery } = useSpecimenUrl();

  return (
    <SpecimenForm
      onSubmit={onSubmit}
      onCancel={navigateToGallery}
    />
  );
};

export default AddSpecimenView;
