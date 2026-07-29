// chakra imports
import { Box, Flex, Stack } from '@chakra-ui/react';
//   Custom components
import Brand from 'components/sidebar/components/Brand';
import Links from 'components/sidebar/components/Links';
import { IRoute } from 'types/navigation';

// FUNCTIONS

interface SidebarContentProps {
	routes: IRoute[];
	isCollapsed?: boolean;
}

function SidebarContent(props: SidebarContentProps) {
	const { routes, isCollapsed } = props;
	// SIDEBAR
	return (
		<Flex direction='column' height='100%' pt='12px' borderRadius='30px'>
			<Brand isCollapsed={isCollapsed} />
			<Stack direction='column' mt='8px' mb='auto'>
				<Box ps={isCollapsed ? '0px' : '20px'} pe={isCollapsed ? '0px' : { lg: '16px', '2xl': '16px' }}>
					<Links routes={routes} isCollapsed={isCollapsed} />
				</Box>
			</Stack>
		</Flex>
	);
}

export default SidebarContent;
